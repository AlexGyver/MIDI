import './index.css'
import UI from '@alexgyver/ui';
import { Midi } from '@tonejs/midi'

/** @type {UI} */
let ui;
let tracks = [];

async function file_h(file) {
    const reader = new FileReader();
    reader.onload = (e) => process(new Midi(e.target.result));
    reader.readAsArrayBuffer(file);
}
async function link_h(url) {
    try {
        process(await Midi.fromUrl(url));
    } catch (e) { }
}

function process(midi) {
    tracks.forEach((t, i) => {
        ui.remove('channel_' + i);
    });

    let BPM = Math.round(midi.header.tempos[0].bpm);
    let dur = 60000 / (BPM * midi.header.ppq);

    tracks = [];
    midi.tracks.forEach(track => {
        if (track.notes.length) {
            let notes = [];
            track.notes.forEach((note, i) => {
                if (!i && note.ticks) {
                    notes.push({
                        us: 0,
                        duration: 0,
                        delay: Math.round(note.ticks * dur),
                    });
                }

                let freq = (440 * Math.pow(2, (note.midi - 69) / 12));
                let duration = Math.round(note.durationTicks * dur);
                let delay = Math.round((track.notes[i + 1] ? (track.notes[i + 1].ticks - note.ticks) : note.durationTicks) * dur);

                notes.push({
                    us: Math.round(1000000 / freq),
                    duration: duration,
                    delay: delay,
                });
            });

            tracks.push({
                name: track.name.length ? track.name : 'Unnamed',
                notes: notes
            });
        }
    });
    tracks.forEach((track, i) => {
        ui.addSwitch('channel_' + i, `${track.name} [${track.notes.length}]`, true, makeText);
    });
    makeText();
    console.log(midi.tracks);

}

function makeText() {
    let h = `#pragma once
#include <GyverMIDI.h>
`;
    tracks.forEach((track, i) => {
        if (!ui['channel_' + i]) return;
        h += `
// ${track.name}
static const GyverMIDI::Note track_${i}[] PROGMEM = {
`;
        track.notes.forEach(note => {
            h += `\t{${note.us}, ${note.duration}, ${note.delay}},\r\n`;
        });
        h += '};\r\n';
    });
    ui.code = h;
}

function copy() {
    navigator.clipboard.writeText(ui.code);
}
function download_h() {
    let enc = new TextEncoder();
    let bytes = enc.encode(ui.code);
    let blob = new Blob([bytes], { type: "text/plain" });
    let link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);

    link.download = 'midi.h';
    link.click();
}

document.addEventListener("DOMContentLoaded", () => {
    if ('serviceWorker' in navigator && typeof USE_SW !== 'undefined') {
        navigator.serviceWorker.register('sw.js');
    }
    ui = new UI({ title: "MIDI Converter", theme: 'light', width: 300 })
        .addFile('file', 'File', file_h)
        .addText('link', 'Link', '', link_h)
        .addArea('code', 'Code', '', null, 15)
        .addButtons({ 'copy': ['Copy', copy], 'h': ['.h', download_h] });
});