import './index.css'
import UI from '@alexgyver/ui';
import { Midi } from '@tonejs/midi'
import { download } from '@alexgyver/utils';

/** @type {UI} */
let ui;
let tracks = [];
let tempos = [];
let ppq = 0;

document.addEventListener("DOMContentLoaded", () => {
    if ('serviceWorker' in navigator && typeof USE_SW !== 'undefined') {
        navigator.serviceWorker.register('sw.js');
    }
    ui = new UI({ title: "MIDI Converter", theme: 'light', width: 300 })
        .addFile('file', 'File', file_h)
        .addText('name', 'Name', 'midi', makeText)
        .addArea('code', 'Code', '', null, 25)
        .addButtons({ 'copy': ['Copy', copy], 'h': ['.h', download_h], 'bins': ['Save bin', download_bin] })
        .addButton('export', 'Export midi', save_midi_h)
});

// =======================================
async function file_h(file) {
    const reader = new FileReader();
    reader.onload = (e) => process(new Midi(e.target.result));
    reader.readAsArrayBuffer(file);
    ui.name = toCVariableName(file.name);
}
async function link_h(url) {
    try {
        process(await Midi.fromUrl(url));
    } catch (e) { }
}

function process(midi) {
    tracks.forEach((track, i) => {
        ui.remove('track_' + i);
    });

    // tempos
    tempos = midi.header.tempos;
    if (!tempos.length) tempos.push({ bpm: 120, ticks: 0, time: 0 });
    ppq = midi.header.ppq;

    // tracks
    midi.tracks.forEach((track, i) => {
        track.channel++;
        if (!track.name.length && i > 0) track.name = midi.tracks[i - 1].name;
        else if (track.channel == 9 || track.channel == 10) track.name += ' (drums)';
    });
    tracks = midi.tracks.filter(t => t.notes.length);

    // ui
    tracks.forEach((track, i) => {
        ui.addSwitch('track_' + i, `${i}: ${track.name} [${track.notes.length}]`, true, makeText);
    });

    makeText();
}

function getNotes() {
    function getDur(tick) {
        const newTemp = tempos.reduce((best, tempo) => (tempo.ticks <= tick && (!best || tempo.ticks > best.ticks)) ? tempo : best, null);
        return 60000 / (newTemp.bpm * ppq);
    }

    function addNote(notes, note, duration, delay) {
        while (delay >= 0) {
            notes.push({
                note: note,
                duration8: encodeExp8(Math.round(duration), 3),
                duration: duration,
                delay: Math.min(Math.round(delay), 65535),
            });
            delay -= 65535;
            duration = 0;
        }
    }

    let notes = [];

    const merged = tracks
        .filter((t, i) => ui['track_' + i])
        .flatMap(t => t.notes)
        .sort((a, b) => a.time - b.time);

    merged.forEach((note, i) => {
        const dur = getDur(note.ticks);

        if (!i && note.ticks) {
            addNote(notes, 0, 0, note.ticks * dur);
        }

        const nextNote = merged[i + 1];
        const delayTicks = nextNote ? nextNote.ticks - note.ticks : note.durationTicks;

        addNote(
            notes,
            note.midi,
            note.durationTicks * dur,
            delayTicks * dur
        );
    });

    return notes;
}
function getNames() {
    return tracks.filter((t, i) => ui['track_' + i]).map(t => t.name).join(' + ');
}

function makeText() {
    const notes = getNotes();

    let h = `#pragma once
#include <Arduino.h>
#include "MIDINote.h"

// Library: https://github.com/GyverLibs/GyverMIDI
// MIDI Converter: https://alexgyver.github.io/MIDI

// ${ui.name}: ${getNames()}
// ${notes.length * (1 + 1 + 2)} bytes
static const MIDINote ${ui.name}[] PROGMEM = {
`;
    notes.forEach(note => h += `\t{${note.note}, ${note.duration8}, ${note.delay}},\r\n`);
    h += '};\r\n';
    ui.code = h;
}

function copy() {
    navigator.clipboard.writeText(ui.code);
}
function download_h() {
    download(new TextEncoder().encode(ui.code), ui.name + '.h', "text/plain");
}

function download_bin() {
    const notes = getNotes();
    const notesCount = notes.length;
    const BYTES_PER_NOTE = 4;
    const TOTAL_BYTES = notesCount * BYTES_PER_NOTE;

    const buffer = new ArrayBuffer(TOTAL_BYTES);
    const view = new DataView(buffer);

    let offset = 0;

    notes.forEach(note => {
        view.setUint8(offset, note.note);
        offset += 1;

        view.setUint8(offset, note.duration8);
        offset += 1;

        view.setUint16(offset, note.delay, true);
        offset += 2;
    });

    download(buffer, ui.name + ".notes");

    // console.log(
    //     [...new Uint8Array(buffer)]
    //         .map(b => `0x${b.toString(16).padStart(2, '0')}`)
    //         .join(', ')
    // );
}

function save_midi_h() {
    let midi = new Midi();
    midi.header.setTempo(120);

    const out = midi.addTrack();
    out.name = getNames();
    out.channel = 0;

    let time = 0;

    getNotes().forEach(n => {
        let dur = n.duration ? (n.duration - 1) : 0;
        out.addNote({ midi: n.note, time: time / 1000.0, duration: dur / 1000.0 });
        time += n.delay;
    });

    download(midi.toArray(), ui.name + '.mid', 'audio/midi');
}

// ================== UTILS ==================
function toCVariableName(input, maxLen = 16) {
    if (!input) return "_";

    // 1. Приводим к lowerCase (по желанию)
    let str = input.toLowerCase();

    // 2. Заменяем пробельные символы на _
    str = str.replace(/\s+/g, "_");

    // 3. Убираем всё, кроме допустимого
    str = str.replace(/[^a-z0-9_]/g, "");

    // 4. Сжимаем несколько _ подряд
    str = str.replace(/_+/g, "_");

    // 5. Убираем _ в начале и конце
    str = str.replace(/^_+|_+$/g, "");

    // 6. Если начинается с цифры — добавляем _
    if (/^\d/.test(str)) {
        str = "_" + str;
    }

    // 7. Сокращаем по _ до maxLen
    if (str.length > maxLen) {
        const parts = str.split("_");
        let result = parts[0];

        for (let i = 1; i < parts.length; i++) {
            if ((result + "_" + parts[i]).length > maxLen) break;
            result += "_" + parts[i];
        }

        str = result.slice(0, maxLen);
    }

    return str || "_";
}

function encodeExp8(v, exp) {
    const EXP_BITS = exp;
    const EXP_MASK = (1 << EXP_BITS) - 1;
    const MAN_BITS = 8 - EXP_BITS;
    const MAN_BASE = 1 << MAN_BITS;
    const MAN_MASK = MAN_BASE - 1;

    if (v < MAN_BASE) return 0;

    let msb = 31 - Math.clz32(v);

    let e = msb - MAN_BITS;
    if (e < 0) e = 0;
    else if (e > EXP_MASK) e = EXP_MASK;

    return (e << MAN_BITS) | ((v >> e) & MAN_MASK);
}