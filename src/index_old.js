import './index.css'
import UI from '@alexgyver/ui';
import { Midi } from '@tonejs/midi'
import encodeExp8 from './ExpInt8';
import { download } from '@alexgyver/utils';

/** @type {UI} */
let ui;
let tracks = [];

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
    tracks.forEach((track) => {
        ui.remove('channel_' + track.channel);
    });

    if (!midi.header.tempos.length) midi.header.tempos.push({ bpm: 120, ticks: 0, time: 0 });

    tracks = [];

    const addNote = (notes, note, duration, delay) => {
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
    const getDur = tick => {
        const newTemp = midi.header.tempos.reduce((best, tempo) => (tempo.ticks <= tick && (!best || tempo.ticks > best.ticks)) ? tempo : best, null);
        return 60000 / (newTemp.bpm * midi.header.ppq);
    }

    midi.tracks.forEach((track, i) => {
        if (!track.notes.length) return;

        let notes = [];
        track.notes.forEach((note, i) => {
            const dur = getDur(note.ticks);
            if (!i && note.ticks) addNote(notes, 0, 0, note.ticks * dur);

            addNote(notes,
                note.midi,
                note.durationTicks * dur,
                (track.notes[i + 1] ? (track.notes[i + 1].ticks - note.ticks) : note.durationTicks) * dur
            );
        });

        track.channel++;
        let name = track.channel + ': ';

        if (track.name.length) name += track.name;
        else if (i > 0 && midi.tracks[i - 1].name.length) name += midi.tracks[i - 1].name;
        else name += 'Unnamed';

        if (track.channel == 9 || track.channel == 10) name += ' [drums]';

        let size = notes.length * (1 + 1 + 2);
        name += ', ' + size + ' bytes';

        tracks.push({
            name: name,
            notes: notes,
            size: size,
            channel: track.channel,
        });
    });
    tracks.forEach((track) => {
        ui.addSwitch('channel_' + track.channel, track.name, true, makeText);
    });

    makeText();
}

function makeText() {
    let total = 0;
    tracks.forEach((track) => {
        if (ui['channel_' + track.channel]) total += track.size;
    });

    let h = `#pragma once
#include "MIDINote.h"

// MIDI Converter: https://alexgyver.github.io/MIDI

// Total: ${total} bytes
`;
    tracks.forEach((track) => {
        if (!ui['channel_' + track.channel]) return;

        h += `
// ${track.name}
static const MIDINote ${ui.name}_${track.channel}[] PROGMEM = {
`;
        track.notes.forEach(note => {
            h += `\t{${note.note}, ${note.duration8}, ${note.delay}},\r\n`;
        });
        h += '};\r\n';
    });
    ui.code = h;
}

function copy() {
    navigator.clipboard.writeText(ui.code);
}
function download_h() {
    download(new TextEncoder().encode(ui.code), ui.name + '.h', "text/plain");
}
function download_bin() {
    tracks.forEach((track) => {
        if (!ui['channel_' + track.channel]) return;

        const notesCount = track.notes.length;
        const BYTES_PER_NOTE = 4;
        const TOTAL_BYTES = 2 + notesCount * BYTES_PER_NOTE;

        const buffer = new ArrayBuffer(TOTAL_BYTES);
        const view = new DataView(buffer);

        let offset = 0;

        view.setUint16(offset, notesCount, true);
        offset += 2;

        track.notes.forEach(note => {
            view.setUint8(offset, note.note);
            offset += 1;

            view.setUint8(offset, note.duration8);
            offset += 1;

            view.setUint16(offset, note.delay, true);
            offset += 2;
        });

        download(buffer, ui.name + '_' + track.channel + ".notes");
    });
}


document.addEventListener("DOMContentLoaded", () => {
    if ('serviceWorker' in navigator && typeof USE_SW !== 'undefined') {
        navigator.serviceWorker.register('sw.js');
    }
    ui = new UI({ title: "MIDI Converter", theme: 'light', width: 300 })
        .addFile('file', 'File', file_h)
        .addText('name', 'Name', 'midi', makeText)
        .addArea('code', 'Code', '', null, 25)
        .addButtons({ 'copy': ['Copy', copy], 'h': ['.h', download_h], 'bins': ['Save bin', download_bin] })
        .addButton('export', 'Export midi', save_h)
});

function save_h() {
    let midi = new Midi();
    midi.header.setTempo(120);

    tracks.forEach((track) => {
        if (!ui['channel_' + track.channel]) return;

        const out = midi.addTrack();
        out.name = track.name;
        out.channel = track.channel - 1;
        let time = 0;
        track.notes.forEach(n => {
            let dur = n.duration ? (n.duration - 2) : 0;
            out.addNote({ midi: n.note, time: time / 1000.0, duration: dur / 1000.0 });
            time += n.delay;
        });
    });

    download(midi.toArray(), ui.name + '.mid', 'audio/midi');
}

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