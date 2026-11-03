#!/usr/bin/env python3
"""Compare timestamp-corrected recorded audio and trailer's encoded audio.

Checks encoding has not shifted source audio; it does not judge how the mix sounds.
"""
import subprocess
import numpy as np

RATE = 8000
SOURCE = 'docs/trailer/source/game-audio.webm'
FINAL = 'docs/trailer/salmon-bear-trailer-first-cut.mp4'

def decode(path, corrected=False):
    args = ['ffmpeg', '-v', 'error', '-i', path]
    if corrected:
        args += ['-af', 'aresample=async=1:first_pts=0']
    args += ['-vn', '-ac', '1', '-ar', str(RATE), '-f', 'f32le', 'pipe:1']
    return np.frombuffer(subprocess.check_output(args), dtype=np.float32)

source = decode(SOURCE, corrected=True)
final = decode(FINAL)
for t in (8, 14, 26, 29, 39, 52, 61):
    a = source[t*RATE:(t+2)*RATE].copy()
    b = final[t*RATE:(t+2)*RATE].copy()
    assert len(a) == len(b) == 2*RATE, f'missing audio at {t}s'
    a -= a.mean()
    b -= b.mean()
    n = 1 << (2*len(a)-1).bit_length()
    c = np.fft.irfft(np.fft.rfft(b, n) * np.conj(np.fft.rfft(a, n)), n)
    r = RATE // 2
    v = np.r_[c[-r:], c[:r+1]]
    lag = int(np.argmax(v)) - r
    corr = float(v.max() / (np.linalg.norm(a)*np.linalg.norm(b)))
    print(f'{t:02d}s offset={lag/RATE*1000:+.1f}ms correlation={corr:.3f}')
    assert abs(lag/RATE) <= 1/30 and corr > .98, f'audio shift/mismatch at {t}s'
print('PASS: encoded audio matches timestamp-corrected recorded audio within one video frame; subjective listening not verified.')
