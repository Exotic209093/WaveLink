"""Select the poster, bake frame zero, and verify the completed Hyperframes film.

Run after Hyperframes renders brag-render.mp4:
    python finish.py --poster-time 1.8
"""
from pathlib import Path
import argparse
import io
import json
import subprocess
from PIL import Image, ImageChops, ImageStat

ROOT = Path(__file__).resolve().parent
FFMPEG = ROOT / 'composition/tools/ffmpeg.exe'
FFPROBE = ROOT / 'composition/node_modules/ffprobe-static/bin/win32/x64/ffprobe.exe'


def run(exe, *args):
    result = subprocess.run([str(exe), *map(str, args)], capture_output=True, text=True,
                            encoding='utf-8', errors='replace')
    if result.returncode:
        raise RuntimeError(result.stderr)
    return result


def probe(path):
    return json.loads(run(FFPROBE, '-v', 'error', '-count_frames', '-show_streams',
                          '-show_format', '-of', 'json', path).stdout)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--poster-time', type=float, required=True)
    args = parser.parse_args()
    raw = ROOT / 'brag-render.mp4'
    poster = ROOT / 'brag.jpg'
    final = ROOT / 'brag.mp4'
    original = probe(raw)
    video = next(s for s in original['streams'] if s['codec_type'] == 'video')
    assert 0 < args.poster_time < float(original['format']['duration'])
    run(FFMPEG, '-hide_banner', '-loglevel', 'error', '-y', '-ss', args.poster_time,
        '-i', raw, '-frames:v', '1', '-q:v', '2', poster)
    run(FFMPEG, '-hide_banner', '-loglevel', 'error', '-y', '-i', raw, '-i', poster,
        '-filter_complex', "[1:v]scale=in_range=pc:out_range=tv:in_color_matrix=bt601:out_color_matrix=bt709,format=yuv420p[poster];[0:v][poster]overlay=0:0:enable='eq(n,0)':format=yuv420[v]",
        '-map', '[v]', '-map', '0:a?', '-c:v', 'libx264', '-crf', '18', '-preset', 'slow',
        '-pix_fmt', 'yuv420p', '-c:a', 'copy', '-movflags', '+faststart',
        '-metadata', 'title=WaveLink 0.7 — Salesforce data, right in your browser.', final)
    encoded = probe(final)
    final_video = next(s for s in encoded['streams'] if s['codec_type'] == 'video')
    assert (final_video['width'], final_video['height']) == (1920, 1080)
    assert final_video['r_frame_rate'] == '30/1'
    assert int(final_video['nb_read_frames']) == int(video['nb_read_frames']) == 750
    assert abs(float(encoded['format']['duration']) - 25) < .05
    assert any(s['codec_type'] == 'audio' for s in encoded['streams'])
    run(FFMPEG, '-v', 'error', '-i', final, '-map', '0:v', '-map', '0:a', '-f', 'null', '-')
    first = subprocess.run([str(FFMPEG), '-v', 'error', '-i', str(final), '-frames:v', '1',
                            '-f', 'image2pipe', '-vcodec', 'png', '-'],
                           capture_output=True, check=True).stdout
    frame_zero = Image.open(io.BytesIO(first)).convert('RGB')
    poster_pixels = Image.open(poster).convert('RGB')
    poster_mae = sum(ImageStat.Stat(ImageChops.difference(frame_zero, poster_pixels)).mean) / 3
    assert poster_mae < 4, f'Frame-zero poster mismatch: {poster_mae:.3f}'
    audio = run(FFMPEG, '-hide_banner', '-i', final, '-vn', '-af', 'ebur128=peak=true',
                '-f', 'null', '-').stderr
    loudness = audio[audio.rfind('Summary:'):]
    report = {
        'duration': float(encoded['format']['duration']),
        'width': final_video['width'], 'height': final_video['height'],
        'fps': final_video['r_frame_rate'], 'frames': int(final_video['nb_read_frames']),
        'bytes': final.stat().st_size, 'full_decode': 'passed',
        'poster_source_seconds': args.poster_time, 'poster_baked_into_frame_zero': True,
        'poster_frame_zero_mean_pixel_error_0_to_255': round(poster_mae, 3),
        'audio_copied_from_hyperframes_render': True, 'audio_analysis': loudness,
        'streams': [{k: s.get(k) for k in ['codec_type', 'codec_name', 'sample_rate', 'channels']}
                    for s in encoded['streams']]
    }
    (ROOT / 'verification.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
