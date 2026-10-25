"""JobVeylo's single-screen, mobile-readable reel and original instrumental."""
from pathlib import Path
import json
import math
import re
import struct
import subprocess
import wave
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H, FPS, DURATION = 1080, 1920, 24, 15
NAVY, WHITE, LIME, MUTED = '#07152F', '#F8FAFF', '#C4FF45', '#AEBDE1'


def font(size, bold=False):
    candidates = [Path('C:/Windows/Fonts') / ('segoeuib.ttf' if bold else 'segoeui.ttf'),
                  Path('/usr/share/fonts/truetype/dejavu') / ('DejaVuSans-Bold.ttf' if bold else 'DejaVuSans.ttf')]
    for path in candidates:
        if path.exists():
            return ImageFont.truetype(str(path), size)
    raise RuntimeError('A supported font is not installed')


def wrapped(draw, value, face, width):
    lines = []
    for paragraph in str(value).splitlines() or ['']:
        line = ''
        for word in paragraph.split():
            if line and draw.textlength(line + ' ' + word, font=face) > width:
                lines.append(line)
                line = ''
            for char in word:
                if draw.textlength(line + char, font=face) > width and line:
                    lines.append(line)
                    line = ''
                line += char
            line += ' '
        if line.strip():
            lines.append(line.strip())
    return lines or ['']


def fit(draw, value, box, *, size=40, minimum=26, bold=False, color=WHITE, align='left', records=None, name=''):
    x, y, right, bottom = box
    width, height = right - x, bottom - y
    sizes = list(range(size, minimum - 1, -2))
    if not sizes or sizes[-1] != minimum:
        sizes.append(minimum)
    for actual in sizes:
        face = font(actual, bold)
        lines = wrapped(draw, value, face, width)
        step = math.ceil(actual * 1.16)
        if len(lines) * step <= height:
            break
    limit = max(1, int(height // step))
    clipped = len(lines) > limit
    if clipped:
        lines = lines[:limit]
        last = lines[-1].rstrip(' .,;')
        while last and draw.textlength(last + '…', font=face) > width:
            last = last[:-1]
        lines[-1] = last + '…'
    for line in lines:
        px = x + (width - draw.textlength(line, font=face)) / 2 if align == 'center' else x
        draw.text((px, y), line, font=face, fill=color, anchor='lt')
        y += step
    if records is not None:
        records.append({'name': name, 'box': list(box), 'font_size': actual, 'lines': lines, 'clipped': clipped})


def disclosed_pay(value):
    value = ' '.join(str(value or '').split())
    return bool(value) and not re.search(r'^(?:not\b|n/?a\b|tbd\b|unknown\b|undisclosed\b|competitive\b|negotiable\b|see\b)', value, re.I)


def icon(draw, kind, x, y):
    ink = '#91A9FF'
    if kind == 'Location':
        draw.ellipse((x + 9, y, x + 57, y + 48), outline=ink, width=5)
        draw.ellipse((x + 26, y + 16, x + 40, y + 30), outline=ink, width=4)
        draw.line([(x + 14, y + 40), (x + 33, y + 69), (x + 53, y + 40)], fill=ink, width=5)
    elif kind == 'Experience':
        draw.rounded_rectangle((x, y + 20, x + 67, y + 65), 7, outline=ink, width=5)
        draw.rounded_rectangle((x + 20, y + 3, x + 47, y + 23), 5, outline=ink, width=5)
        draw.line((x + 3, y + 40, x + 64, y + 40), fill=ink, width=4)
    elif kind == 'Qualification':
        draw.polygon([(x - 3, y + 24), (x + 34, y + 5), (x + 72, y + 24), (x + 34, y + 44)], outline=ink, width=5)
        draw.arc((x + 12, y + 28, x + 57, y + 66), 0, 180, fill=ink, width=5)
        draw.line((x + 69, y + 27, x + 69, y + 62), fill=ink, width=4)
    else:
        draw.rounded_rectangle((x, y + 11, x + 70, y + 59), 6, outline=ink, width=5)
        draw.ellipse((x + 25, y + 24, x + 44, y + 44), outline=ink, width=4)
        draw.line((x + 10, y + 34, x + 17, y + 34), fill=ink, width=4)
        draw.line((x + 53, y + 34, x + 60, y + 34), fill=ink, width=4)


def poster(job):
    image = Image.new('RGB', (W, H), NAVY)
    glow = Image.new('RGBA', (W, H))
    glow_draw = ImageDraw.Draw(glow)
    glow_draw.ellipse((825, -340, 1420, 310), fill=(42, 91, 230, 125))
    glow_draw.ellipse((-280, 1660, 270, 2200), fill=(37, 73, 220, 95))
    image = Image.alpha_composite(image.convert('RGBA'), glow.filter(ImageFilter.GaussianBlur(65))).convert('RGB')
    draw, records = ImageDraw.Draw(image), []
    brand = font(50, True)
    draw.text((88, 140), 'Job', font=brand, fill=WHITE, anchor='lt')
    draw.text((88 + draw.textlength('Job', font=brand), 140), 'Veylo', font=brand, fill=LIME, anchor='lt')
    draw.rounded_rectangle((650, 137, 932, 187), 25, fill='#13284C')
    fit(draw, 'DESIGN PREVIEW' if job.get('_preview') else 'JOB OPENING', (666, 151, 916, 181), size=23, minimum=20, align='center', color=MUTED)
    fit(draw, 'HIRING AT', (90, 254, 925, 291), size=25, minimum=25, color=MUTED)
    fit(draw, str(job.get('company', '')).upper(), (88, 300, 932, 410), size=62, minimum=32, bold=True, records=records, name='company')
    fit(draw, job.get('title', ''), (88, 430, 932, 665), size=100, minimum=42, bold=True, color=LIME, records=records, name='title')
    facts = [('Location', job.get('location') or 'See employer notice'),
             ('Experience', job.get('experience') or 'Not specified by employer'),
             ('Qualification', job.get('education') or 'Not specified by employer')]
    if disclosed_pay(job.get('salary')):
        facts.append(('Salary', job['salary']))
    stride = 480 // len(facts)
    for index, (label, value) in enumerate(facts):
        top = 690 + stride * index
        draw.rounded_rectangle((88, top, 932, top + stride - 10), 18, fill='#102342', outline='#20375A', width=2)
        icon(draw, label, 116, top + (stride - 80) // 2)
        fit(draw, label, (210, top + 10, 903, top + 38), size=23, minimum=23, color=MUTED)
        fit(draw, value, (210, top + 43, 903, top + stride - 14), size=37, minimum=26, bold=True, records=records, name=label.lower())
    draw.rounded_rectangle((88, 1190, 932, 1470), 30, fill=LIME)
    # Outline resume icon, without scores, seals or guarantees.
    draw.line([(122, 1247), (122, 1385), (196, 1385), (196, 1276), (169, 1247), (122, 1247)], fill=NAVY, width=6)
    draw.line([(169, 1247), (169, 1276), (196, 1276)], fill=NAVY, width=5)
    for yy in [1300, 1320, 1340, 1360]:
        draw.line((138, yy, 179, yy), fill=NAVY, width=4)
    fit(draw, 'TAILOR YOUR\nATS-FRIENDLY RESUME\nFOR THIS JOB', (232, 1220, 901, 1412), size=44, minimum=36, bold=True, color=NAVY, records=records, name='resume_service')
    fit(draw, 'Upload → tailor → review & download', (116, 1423, 904, 1460), size=28, minimum=25, color=NAVY, align='center')
    draw.rounded_rectangle((88, 1523, 932, 1607), 42, fill='#294AFF')
    fit(draw, 'VIEW JOB + TAILOR RESUME', (112, 1545, 906, 1593), size=37, minimum=29, bold=True, align='center', records=records, name='call_to_action')
    fit(draw, 'Link in bio · @jobveylo', (88, 1635, 932, 1675), size=29, minimum=26, align='center')
    fit(draw, 'jobveylo.jobveylo.workers.dev', (88, 1700, 932, 1732), size=23, minimum=21, color=MUTED, align='center')
    fit(draw, 'Sample job details · design preview' if job.get('_preview') else 'Check full eligibility on JobVeylo', (88, 1752, 932, 1783), size=21, minimum=20, color=MUTED, align='center')
    return image, records


def music(target):
    """One original mellow electronic instrumental, reused across JobVeylo reels."""
    rate, beat_seconds = 44100, 0.6
    chords = [(130.81, 164.81, 196, 246.94), (110, 130.81, 164.81, 196),
              (87.31, 110, 130.81, 164.81), (98, 123.47, 146.83, 196)]
    melody = [523.25, 659.25, 783.99, 659.25, 587.33, 659.25, 523.25, 392]
    data = bytearray()
    for n in range(rate * DURATION):
        t, beat = n / rate, (n / rate) % beat_seconds
        chord = chords[min(3, int(t / (DURATION / 4)))]
        pad = sum(math.sin(2 * math.pi * tone * t) for tone in chord) * 0.024
        kick = math.sin(2 * math.pi * (48 * beat + 18 * (1 - math.exp(-25 * beat)))) * math.exp(-25 * beat) * 0.11
        bell = math.sin(2 * math.pi * melody[int(t / beat_seconds) % len(melody)] * t) * math.exp(-7 * beat) * 0.037
        fade = max(0, min(1, t / 0.5, (DURATION - t) / 1.4))
        data.extend(struct.pack('<h', int(max(-1, min(1, (pad + kick + bell) * fade)) * 32767)))
    with wave.open(str(target), 'wb') as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(rate)
        wav.writeframes(data)


def render(job, target, work):
    import imageio_ffmpeg
    work, target = Path(work), Path(target)
    work.mkdir(parents=True, exist_ok=True)
    base, records = poster(job)
    base.save(work / 'poster.png')
    base.resize((540, 960)).save(work / 'contact-sheet.png')
    (work / 'layout.json').write_text(json.dumps(records, indent=2), encoding='utf-8')
    audio = work / 'original.wav'
    music(audio)
    command = [imageio_ffmpeg.get_ffmpeg_exe(), '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-', '-i', str(audio), '-c:v', 'libx264', '-preset', 'fast', '-crf', '26', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', '-shortest', str(target)]
    with (work / 'encode.log').open('wb') as log:
        process = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=log, stderr=log)
        try:
            for frame in range(FPS * DURATION):
                image = base.copy()
                # Only a fine accent pulses; all job and resume details remain visible.
                strength = int(110 + 80 * (1 + math.sin(2 * math.pi * frame / FPS / 2)) / 2)
                ImageDraw.Draw(image).rounded_rectangle((88, 1523, 932, 1607), 42, outline=(strength, 210, 150), width=2)
                process.stdin.write(image.tobytes())
            process.stdin.close()
            result = process.wait()
        except BaseException:
            process.kill()
            process.wait()
            raise
    if result or not target.exists() or target.stat().st_size > 1500000:
        raise RuntimeError('Reel encoding failed or exceeded the upload limit')
