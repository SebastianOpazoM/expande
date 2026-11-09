"""Export original vector paths from the supplied six-page Expande brand manual.

Requires pypdf and pypdfium2. No text reconstruction, tracing or raster conversion.
"""
import argparse
import ctypes
import hashlib
import json
from pathlib import Path

import pypdfium2 as pdfium
import pypdfium2.raw as raw
from pypdf import PdfReader


def number(value):
    return f"{float(value):.6f}".rstrip("0").rstrip(".") or "0"


def export_paths(page, indices, destination, square=False, page_number=1):
    objects = list(page.get_objects())
    selected = [objects[index] for index in indices]
    bounds = [obj.get_bounds() for obj in selected]
    left, bottom = min(b[0] for b in bounds), min(b[1] for b in bounds)
    right, top = max(b[2] for b in bounds), max(b[3] for b in bounds)
    width, height = right - left, top - bottom
    if square:
        side = max(width, height) + 12
        left -= (side - width) / 2
        top += (side - height) / 2
        width = height = side
    paths = []
    for obj in selected:
        assert raw.FPDFPageObj_GetType(obj) == raw.FPDF_PAGEOBJ_PATH
        matrix = raw.FS_MATRIX()
        assert raw.FPDFPageObj_GetMatrix(obj, ctypes.byref(matrix))
        rgba = [ctypes.c_uint() for _ in range(4)]
        assert raw.FPDFPageObj_GetFillColor(obj, *[ctypes.byref(v) for v in rgba])
        fill_mode, stroke = ctypes.c_int(), ctypes.c_int()
        assert raw.FPDFPath_GetDrawMode(obj, ctypes.byref(fill_mode), ctypes.byref(stroke))
        assert not stroke.value, "Unexpected stroked path; review the source artwork."
        segments = []
        for index in range(raw.FPDFPath_CountSegments(obj)):
            segment = raw.FPDFPath_GetPathSegment(obj, index)
            x, y = ctypes.c_float(), ctypes.c_float()
            assert raw.FPDFPathSegment_GetPoint(segment, ctypes.byref(x), ctypes.byref(y))
            segments.append((raw.FPDFPathSegment_GetType(segment), x.value, y.value,
                             bool(raw.FPDFPathSegment_GetClose(segment))))
        commands, index = [], 0
        while index < len(segments):
            kind, x, y, close = segments[index]
            if kind == raw.FPDF_SEGMENT_BEZIERTO:
                curve = segments[index:index + 3]
                assert len(curve) == 3 and all(s[0] == kind for s in curve)
                commands.append("C" + " ".join(number(v) for s in curve for v in s[1:3]))
                close = curve[-1][3]
                index += 3
            else:
                assert kind in (raw.FPDF_SEGMENT_MOVETO, raw.FPDF_SEGMENT_LINETO)
                commands.append(("M" if kind == raw.FPDF_SEGMENT_MOVETO else "L") + number(x) + " " + number(y))
                index += 1
            if close:
                commands.append("Z")
        color = "#" + "".join(f"{v.value:02X}" for v in rgba[:3])
        transform = " ".join(number(getattr(matrix, key)) for key in ("a", "b", "c", "d", "e", "f"))
        rule = "evenodd" if fill_mode.value == raw.FPDF_FILLMODE_ALTERNATE else "nonzero"
        paths.append(f'<path fill="{color}" fill-opacity="{number(rgba[3].value / 255)}" fill-rule="{rule}" transform="matrix({transform})" d="{" ".join(commands)}"/>')
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {number(width)} {number(height)}">\n'
           f'<g transform="translate({number(-left)} {number(top)}) scale(1 -1)">\n' +
           "\n".join(paths) + "\n</g>\n</svg>\n")
    destination.write_text(svg, encoding="utf-8")
    return {"asset": destination.as_posix(), "page": page_number,
            "object_indices": list(indices), "viewBox": [0, 0, width, height],
            "sha256": hashlib.sha256(destination.read_bytes()).hexdigest()}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("--output-dir", type=Path, default=Path("public/brands/expande"))
    args = parser.parse_args()
    doc = pdfium.PdfDocument(args.source)
    assert len(doc) == 6, "Review page/object selection for a different manual."
    args.output_dir.mkdir(parents=True, exist_ok=True)
    variants = [
        (1, range(0, 14), "logo-color.svg", False),
        (1, range(15, 29), "logo-white.svg", False),
        (1, range(29, 43), "logo-black.svg", False),
        (1, [13], "mark-x.svg", True),
        (2, [4], "plus-magenta.svg", False),
        (2, [5], "plus-yellow.svg", False),
        (2, [6], "plus-mint.svg", False),
    ]
    exports = [export_paths(doc[page], indices, args.output_dir / filename, square, page + 1)
               for page, indices, filename, square in variants]
    reader = PdfReader(args.source)
    colors = {}
    for entry in reader.pages[0]["/Resources"]["/ColorSpace"].values():
        space = entry.get_object()
        if space[0] == "/Separation":
            colors[str(space[1])[1:]] = "#" + "".join(f"{round(float(v) * 255):02X}" for v in space[3]["/C1"])
    manifest = {"source_filename": args.source.name,
                "source_sha256": hashlib.sha256(args.source.read_bytes()).hexdigest(),
                "method": "Original PDF vector paths, matrices, fill rules and converted fill colors exported through PDFium; no redraw or generated logo.",
                "palette_method": "Embedded Separation tint-transform RGB alternatives, rounded to 8-bit channels.",
                "colors": colors, "exports": exports}
    Path("content/expande-brand-assets.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"assets": len(exports), "colors": colors}))


if __name__ == "__main__":
    main()
