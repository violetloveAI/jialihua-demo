#!/usr/bin/env python3
"""Render reproducible typography cards. No generated imagery or private input."""
import json, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

spec=json.load(sys.stdin)
out=Path(spec['directory'])
fontfile='/System/Library/Fonts/STHeiti Medium.ttc'
def font(size): return ImageFont.truetype(fontfile,size)
def wrapped(draw,text,size,width):
    lines=[]
    for paragraph in text.split('\n'):
        line=''
        for char in paragraph:
            if draw.textlength(line+char,font=font(size))>width and line:
                if char in '，。！？；：、）】》”’':
                    lines.append(line[:-1]);line=line[-1:]
                else:
                    lines.append(line);line=''
            line+=char
        lines.append(line)
    return lines
for i,text in enumerate(spec['pages']):
    image=Image.new('RGB',(720,1280),'#f3f4e8');draw=ImageDraw.Draw(image)
    draw.rounded_rectangle((34,38,686,1218),28,fill='#fffcf2')
    draw.rounded_rectangle((56,63,230,116),26,fill='#2e634d')
    draw.text((80,74),'家里话',font=font(30),fill='#fffef2')
    draw.text((478,78),'慢慢看 · 慢慢听',font=font(23),fill='#4e685a')
    label='河南话旁白' if spec['language']=='henan' else '小艺普通话旁白'
    draw.text((58,159),label,font=font(26),fill='#55705c')
    for j,line in enumerate(wrapped(draw,spec['title'],44,600)):
        draw.text((58,211+j*59),line,font=font(44),fill='#243d30')
    draw.line((58,352,658,352),fill='#c9d2b9',width=2)
    lines=wrapped(draw,text,57,590)
    if len(lines)>9: raise ValueError('Page text exceeds readable card capacity')
    glyphs=[];cursor=0
    for j,line in enumerate(lines):
        draw.text((63,407+j*76),line,font=font(57),fill='#283c2f')
        prefix=''
        for char in line:
            index=text.find(char,cursor)
            glyphs.append(dict(index=index,x=63+draw.textlength(prefix,font=font(57)),y=407+j*76+60,width=draw.textlength(char,font=font(57))))
            prefix+=char;cursor=index+len(char)
    (out/f'P3-{spec["language"]}-page{i+1}.json').write_text(json.dumps(glyphs))
    draw.text((58,1113),f'{i+1:02d} / {len(spec["pages"]):02d}',font=font(28),fill='#2e634d')
    draw.text((58,1164),'虚构演示 · 预先编写解释 · AI 合成旁白',font=font(23),fill='#607361')
    image.save(out/f'P3-{spec["language"]}-page{i+1}.png')
    if i==0 and spec['language']=='mandarin': image.save(out/'P3-poster.png')
