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


def short_salary(value):
    value = ' '.join(str(value or '').split())
    match = re.fullmatch(r'INR\s+(\d+(?:\.\d+)?)\s*[–-]\s*(\d+(?:\.\d+)?)\s*/\s*(?:1\s*)?YEAR', value, re.I)
    if match:
        return f'₹{float(match[1])/100000:g}–{float(match[2])/100000:g} lakh/year'
    return value


def known_education(value):
    return bool(value) and not re.match(r'^(not\b|no explicit\b|see\b|unknown\b|n/?a\b)', str(value), re.I)


def poster(job):
    """Two single-page hierarchies; duration, audio, colors and facts stay the same."""
    image = Image.new('RGB', (W, H), NAVY)
    draw, records = ImageDraw.Draw(image), []
    variant = 'B' if job.get('variant') == 'B' else 'A'
    fit(draw, 'JobVeylo', (90, 135, 930, 195), size=48, minimum=48, bold=True, color=LIME)
    fit(draw, 'SAMPLE · NOW HIRING' if job.get('_preview') else 'NOW HIRING', (90, 216, 930, 254), size=25, minimum=25, color=MUTED)
    location = str(job.get('location') or 'Check employer location')
    hook = str(job.get('hook') or ('INTERNSHIP' if re.search(r'\bintern(?:ship)?\b', str(job.get('title', '')), re.I) else job.get('experience') or 'Check experience in notice'))
    company, title = str(job.get('company', '')), str(job.get('title', ''))
    # Location already has its own large row; avoid repeating it in the title.
    for place in ['Bangalore, India', 'Bengaluru, India']:
        if place.split(',')[0].lower().replace('bangalore','bengaluru') in location.lower().replace('bangalore','bengaluru') or 'India' == location:
            title = title.replace(' (' + place + ')', '')
    if variant == 'A':
        draw.rounded_rectangle((88, 290, 932, 425), 22, fill=LIME)
        fit(draw, hook.upper(), (115, 315, 905, 405), size=56, minimum=36, bold=True, color=NAVY, records=records, name='experience_hook')
        fit(draw, company.upper(), (90, 460, 930, 540), size=53, minimum=38, bold=True, records=records, name='company')
        fit(draw, title, (90, 570, 930, 785), size=80, minimum=44, bold=True, records=records, name='title')
    else:
        fit(draw, company.upper(), (90, 290, 930, 370), size=53, minimum=38, bold=True, records=records, name='company')
        fit(draw, title, (90, 395, 930, 610), size=80, minimum=44, bold=True, records=records, name='title')
        draw.rounded_rectangle((88, 650, 932, 785), 22, fill=LIME)
        fit(draw, hook.upper(), (115, 675, 905, 765), size=56, minimum=36, bold=True, color=NAVY, records=records, name='experience_hook')
    draw.rounded_rectangle((88, 820, 932, 1010), 22, fill='#102342')
    fit(draw, 'LOCATION / ELIGIBILITY', (115, 840, 905, 875), size=25, minimum=25, color=MUTED)
    fit(draw, location, (115, 890, 905, 990), size=43, minimum=32, bold=True, records=records, name='location')
    salary = short_salary(job.get('salary'))
    education = str(job.get('education') or '')
    facts = []
    if disclosed_pay(salary):
        facts.append(salary)
    if known_education(education):
        facts.append(education)
    if facts:
        fit(draw, '\n'.join(facts), (90, 1050, 930, 1245), size=39, minimum=32, records=records, name='facts')
    else:
        fit(draw, 'Read the employer’s full eligibility before applying.', (90, 1060, 930, 1195), size=36, minimum=32, color=MUTED)
    draw.rounded_rectangle((88, 1290, 932, 1420), 22, fill='#102342', outline='#294AFF', width=3)
    fit(draw, '1. Open the bio link\n2. Search company + role', (115, 1315, 905, 1400), size=34, minimum=30, records=records, name='apply_steps')
    draw.rounded_rectangle((88, 1480, 932, 1595), 30, fill=LIME)
    fit(draw, 'VIEW JOB · LINK IN BIO', (115, 1515, 905, 1575), size=46, minimum=36, bold=True, color=NAVY, align='center', records=records, name='call_to_action')
    fit(draw, 'Search: ' + company + ' · ' + title, (90, 1630, 930, 1740), size=29, minimum=26, align='center', color=WHITE, records=records, name='search_hint')
    fit(draw, '@jobveylo · Check full eligibility', (90, 1770, 930, 1815), size=26, minimum=24, align='center', color=MUTED)
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
                # Only a fine accent pulses; all job details remain visible.
                strength = int(110 + 80 * (1 + math.sin(2 * math.pi * frame / FPS / 2)) / 2)
                ImageDraw.Draw(image).rounded_rectangle((88, 1480, 932, 1595), 30, outline=(strength, 210, 150), width=2)
                process.stdin.write(image.tobytes())
            process.stdin.close()
            result = process.wait()
        except BaseException:
            process.kill()
            process.wait()
            raise
    if result or not target.exists() or target.stat().st_size > 1500000:
        raise RuntimeError('Reel encoding failed or exceeded the upload limit')
