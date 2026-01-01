// @ts-expect-error
import { Parser } from 'binary-parser';


const DummyParser = new Parser();

const StringParser = new Parser().endianness('little')
    .uint16('unk', { assert: 3 })
    .uint16('length')
    .string('string', { length: 'length', stripNull: true });

const ObjectParser = new Parser().endianness('little')
    .uint16('magic', { assert: 2 })
    .uint16('id')
    .choice({ tag: 'id', defaultChoice: DummyParser, choices: {
        100: StringParser
    } });

const ObjectSectionParser = new Parser().endianness('little')
    .array('objects', { type: ObjectParser, readUntil: 'eof' });

const ObjectFlagParser = new Parser().endianness('little')
    .bit8('unused1')
    .bit1('visible')
    .bit1('flip_horizontal')
    .bit1('flip_vertical')
    .bit1('locked')
    .bit4('unused2');

const ObjectFlagSectionParser = new Parser().endianness('little')
    .uint16('section_id', { assert: 4 })
    .uint16('unk')
    .uint16('length')
    .array('values', { type: ObjectFlagParser, length: 'length' });

const CoordinatesParser = new Parser().endianness('little')
    .uint16('x')
    .uint16('y');

const CoordinateSectionParser = new Parser().endianness('little')
    .uint16('section_id', { assert: 5 })
    .uint16('unk')
    .uint16('length')
    .array('values', { type: CoordinatesParser, length: 'length' });

const AngleSectionParser = new Parser().endianness('little')
    .uint16('section_id', { assert: 6 })
    .uint16('unk')
    .uint16('length')
    .array('values', { type: 'int16le', length: 'length' });

const ScaleSectionParser = new Parser().endianness('little')
    .uint16('section_id', { assert: 7 })
    .uint16('unk')
    .uint16('length')
    .array('values', { type: 'uint8', length: function() {
        // padded to 2 bytes
        return Math.ceil(this.length / 2) * 2;
    } });

const ColorParser = new Parser().endianness('little')
    .uint8('red')
    .uint8('green')
    .uint8('blue')
    .uint8('transparency');

const ColorSectionParser = new Parser().endianness('little')
    .uint16('section_id', { assert: 8 })
    .uint16('unk')
    .uint16('length')
    .array('values', { type: ColorParser, length: 'length' });

const ParamSectionParser = new Parser().endianness('little')
    .uint16('section_id')
    .uint16('unk')
    .uint16('length')
    .array('values', { type: 'uint16le', length: 'length' });

const StrategyBoardParser = new Parser().endianness('little')
    .uint32('header_magic')
    .uint16('length1')
    .uint32('header_unk1').uint32('header_unk2').uint32('header_unk3')
    .uint16('length2')
    .uint32('header_unk4')

    .uint16('section_id', { assert: 1 })
    .uint16('board_name_length')
    .string('board_name', { length: 'board_name_length', stripNull: true })

    // we cheat a little by adding state to the parser to keep track of bytes we can still safely read
    .wrapped({ wrapper: (b: Uint8Array) => b, type: ObjectSectionParser, readUntil: function(value: number) {
        // console.log(value, this.___readingString, this.___remainingBytes)
        if (!this.___remainingBytes || this.___remainingBytes === 0) {
            // string reading
            if (this.___prepareStringRead) {
                // read the entire string + the two bytes used for the length
                this.___remainingBytes = value + 2;
                this.___prepareStringRead = false;
                this.___readingString = true;
            } else {
                if (value === 2) {
                    this.___remainingBytes = 4;
                } else {
                    return true;
                }
            }
        }

        // type is 100, this is a string
        if (!this.___prepareStringRead && !this.___readingString && value === 100 && this.___remainingBytes == 2) {
            this.___prepareStringRead = true;
            // prepare to read the string length
            this.___remainingBytes = 4;
        }

        if (this.___remainingBytes > 0) {
            this.___remainingBytes--;
            if (this.___readingString && this.___remainingBytes === 0) {
                this.___readingString = false;
            }
        }

        return false;
    } })

    .nest('object_flags', { type: ObjectFlagSectionParser })
    .nest('coordinates', { type: CoordinateSectionParser })
    .nest('angles', { type: AngleSectionParser })
    .nest('scales', { type: ScaleSectionParser })
    .nest('colors', { type: ColorSectionParser })
    .nest('params1', { type: ParamSectionParser })
    .nest('params2', { type: ParamSectionParser })
    .nest('params3', { type: ParamSectionParser })

    .uint16('footer_magic', { assert: 3 })
    .uint16('footer_unk1').uint16('footer_unk2')
    .uint16('background');

export function parseStrategyBoardData(strategyBoardData: Uint8Array): StrategyBoard {
    const strategyBoard: RawStrategyBoard = StrategyBoardParser.parse(strategyBoardData);
    const strategyBoardObjects: SBObject[] = [];

    for (let i = 0; i < strategyBoard.objects.length; i++) {
        const flags: SBObjectFlags = {
            visible: strategyBoard.object_flags.values[i].visible === 1,
            flipHorizontal: strategyBoard.object_flags.values[i].flip_horizontal === 1,
            flipVertical: strategyBoard.object_flags.values[i].flip_vertical === 1
        };

        const coordinates: Coordinates = {
            x: Math.round(strategyBoard.coordinates.values[i].x / 5120 * 1024),
            y: Math.round(strategyBoard.coordinates.values[i].y / 3840 * 768)
        };

        const color: Color = {
            red: strategyBoard.colors.values[i].red,
            green: strategyBoard.colors.values[i].green,
            blue: strategyBoard.colors.values[i].blue,
            alpha: 1 - strategyBoard.colors.values[i].transparency / 100,
        };

        strategyBoardObjects.push({
            id: strategyBoard.objects[i].id,
            string: strategyBoard.objects[i].string,
            flags,
            coordinates,
            angle: strategyBoard.angles.values[i] / 180 * Math.PI,
            scale: strategyBoard.scales.values[i],
            color,
            param1: strategyBoard.params1.values[i],
            param2: strategyBoard.params2.values[i],
            param3: strategyBoard.params3.values[i]
        });
    }

    return {
        objects: strategyBoardObjects.reverse(),
        background: strategyBoard.background
    };
}

interface RawSBObject {
    id: number;
    string?: string;
}

interface RawSBObjectFlags {
    visible: number;
    flip_horizontal: number;
    flip_vertical: number;
}

interface Coordinates {
    x: number;
    y: number;
}

interface RawColor {
    red: number;
    green: number;
    blue: number;
    transparency: number;
}

interface RawStrategyBoard {
    objects: RawSBObject[];
    object_flags: { values: RawSBObjectFlags[]; };
    coordinates: { values: Coordinates[]; };
    angles: { values: number[]; };
    scales: { values: number[]; }
    colors: { values: RawColor[]; };
    params1: { values: number[]; };
    params2: { values: number[]; };
    params3: { values: number[]; };
    background: number;
}

interface SBObjectFlags {
    visible: boolean;
    flipHorizontal: boolean;
    flipVertical: boolean;
}

interface Color {
    red: number;
    green: number;
    blue: number;
    alpha: number;
}

export interface SBObject {
    id: number;
    string?: string;
    flags: SBObjectFlags;
    coordinates: Coordinates;
    angle: number;
    scale: number;
    color: Color;
    param1: number;
    param2: number;
    param3: number;
}

export interface StrategyBoard {
    objects: SBObject[];
    background: number;
}
