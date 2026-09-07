import json, os, textwrap
from PIL import Image, ImageDraw, ImageFont

BASE = os.path.dirname(os.path.abspath(__file__))
APPS = os.path.join(BASE, "applications")
LABELS = os.path.join(BASE, "labels")
os.makedirs(APPS, exist_ok=True)
os.makedirs(LABELS, exist_ok=True)

import sys
from PIL import ImageFilter

def find_font(*candidates):
    """First font file that exists. Liberation on Linux, Times/Arial on macOS."""
    for c in candidates:
        if os.path.exists(c):
            return c
    raise FileNotFoundError(f"No font found among: {candidates}")

MAC = "/System/Library/Fonts/Supplemental/"
LIB = "/usr/share/fonts/truetype/liberation/"
F = find_font(LIB + "LiberationSerif-Bold.ttf", MAC + "Times New Roman Bold.ttf")
FI = find_font(LIB + "LiberationSerif-Italic.ttf", MAC + "Times New Roman Italic.ttf")
FR = find_font(LIB + "LiberationSerif-Regular.ttf", MAC + "Times New Roman.ttf")
SANS = find_font(LIB + "LiberationSans-Regular.ttf", MAC + "Arial.ttf")
SANS_B = find_font(LIB + "LiberationSans-Bold.ttf", MAC + "Arial Bold.ttf")

WARNING_STD = (
    "GOVERNMENT WARNING: (1) According to the Surgeon General, women should not "
    "drink alcoholic beverages during pregnancy because of the risk of birth "
    "defects. (2) Consumption of alcoholic beverages impairs your ability to "
    "drive a car or operate machinery, and may cause health problems."
)

ACCENT = {"spirits": (122, 47, 27), "wine": (91, 20, 33), "beer": (156, 108, 20)}
PAPER = (250, 246, 235)

def wrap(draw, text, font, max_w):
    words = text.split()
    lines, cur = [], ""
    for w in words:
        trial = (cur + " " + w).strip()
        if draw.textlength(trial, font=font) <= max_w:
            cur = trial
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines

def render(fixture_id, product_type, brand, class_type, abv, net_contents,
           address, country_of_origin, warning_text, warning_bold_caps=True, degrade=False):
    W, H = 1000, 1400
    img = Image.new("RGB", (W, H), (235, 231, 218))
    d = ImageDraw.Draw(img)
    accent = ACCENT[product_type]
    margin = 40
    d.rectangle([margin, margin, W - margin, H - margin], fill=PAPER, outline=accent, width=6)
    d.rectangle([margin + 14, margin + 14, W - margin - 14, H - margin - 14], outline=accent, width=2)

    y = margin + 60
    f_brand = ImageFont.truetype(F, 58)
    lines = wrap(d, brand, f_brand, W - 2 * margin - 120)
    for ln in lines:
        w = d.textlength(ln, font=f_brand)
        d.text(((W - w) / 2, y), ln, font=f_brand, fill=(30, 24, 18))
        y += 68
    y += 10
    d.line([margin + 100, y, W - margin - 100, y], fill=accent, width=3)
    y += 30

    f_class = ImageFont.truetype(FI, 34)
    lines = wrap(d, class_type, f_class, W - 2 * margin - 140)
    for ln in lines:
        w = d.textlength(ln, font=f_class)
        d.text(((W - w) / 2, y), ln, font=f_class, fill=(60, 50, 40))
        y += 42
    y += 30

    f_body = ImageFont.truetype(FR, 30)
    if abv is not None:
        proof = round(abv * 2)
        abv_line = f"{abv:g}% Alc./Vol. ({proof} Proof)" if product_type == "spirits" else f"{abv:g}% ALC/VOL"
        w = d.textlength(abv_line, font=f_body)
        d.text(((W - w) / 2, y), abv_line, font=f_body, fill=(30, 24, 18))
        y += 42
    w = d.textlength(net_contents, font=f_body)
    d.text(((W - w) / 2, y), net_contents, font=f_body, fill=(30, 24, 18))
    y += 60

    f_addr = ImageFont.truetype(FR, 24)
    for ln in wrap(d, address, f_addr, W - 2 * margin - 160):
        w = d.textlength(ln, font=f_addr)
        d.text(((W - w) / 2, y), ln, font=f_addr, fill=(60, 50, 40))
        y += 30
    if country_of_origin:
        y += 10
        line = f"Product of {country_of_origin}"
        w = d.textlength(line, font=f_addr)
        d.text(((W - w) / 2, y), line, font=f_addr, fill=(60, 50, 40))
        y += 30

    # Government warning box, pinned near the bottom.
    box_top = H - margin - 260
    box_bottom = H - margin - 40
    d.rectangle([margin + 40, box_top, W - margin - 40, box_bottom], outline=(20, 20, 20), width=2)
    ty = box_top + 20
    lead = "Government Warning:" if not warning_bold_caps else "GOVERNMENT WARNING:"
    body = warning_text
    if body.startswith(lead) or body.upper().startswith("GOVERNMENT WARNING:"):
        idx = len(lead) if body.startswith(lead) else len("GOVERNMENT WARNING:")
        rest = body[idx:].strip()
    else:
        rest = body
    f_lead = ImageFont.truetype(SANS_B, 22)
    f_rest = ImageFont.truetype(SANS, 20)
    d.text((margin + 56, ty), lead, font=f_lead, fill=(10, 10, 10))
    ty += 30
    for ln in wrap(d, rest, f_rest, W - 2 * margin - 112):
        d.text((margin + 56, ty), ln, font=f_rest, fill=(10, 10, 10))
        ty += 26

    if degrade:
        # Simulate a bad phone photo: heavy blur, slight tilt, washed-out contrast.
        img = img.rotate(4, resample=Image.BICUBIC, expand=False, fillcolor=(235, 231, 218))
        img = img.filter(ImageFilter.GaussianBlur(radius=7))
        img = Image.blend(img, Image.new("RGB", img.size, (200, 196, 186)), 0.35)
    img.save(os.path.join(LABELS, f"{fixture_id}.png"))

def write_app(fixture_id, product_type, brand, class_type, abv, net_contents,
              address, is_import, country_of_origin):
    data = {
        "id": fixture_id,
        "productType": product_type,
        "brandName": brand,
        "classType": class_type,
        "alcoholContent": abv,
        "netContents": net_contents,
        "bottlerNameAddress": address,
        "isImport": is_import,
        "countryOfOrigin": country_of_origin,
    }
    with open(os.path.join(APPS, f"{fixture_id}.json"), "w") as f:
        json.dump(data, f, indent=2)
        f.write("\n")

FIXTURES = [
    # id, product, app_brand, label_brand, class_type_app, class_type_label,
    # abv_app, abv_label, net_app, net_label, addr_app, addr_label,
    # is_import, coo_app, coo_label, warning_text, warning_caps, expected
    dict(id="stones-throw-ok", product="spirits",
         app_brand="STONE'S THROW", label_brand="Stone's Throw",
         class_type="Kentucky Straight Bourbon Whiskey",
         abv=45, abv_label=45,
         net="750 mL",
         addr="Stone's Throw Distilling Co., 412 River Road, Bardstown, KY 40004",
         is_import=False, coo=None,
         warning=WARNING_STD, warning_caps=True,
         expected="pass — brand differs only in casing"),
    dict(id="abv-off-by-1", product="spirits",
         app_brand="Ridgeline Reserve", label_brand="Ridgeline Reserve",
         class_type="Straight Rye Whiskey",
         abv=40.0, abv_label=41.0,
         net="750 mL",
         addr="Ridgeline Distilling Co., 88 Summit Ave, Louisville, KY 40202",
         is_import=False, coo=None,
         warning=WARNING_STD, warning_caps=True,
         expected="fail — ABV off by 1.0 (outside +/-0.3 tolerance)"),
    dict(id="abv-off-by-0.2", product="beer",
         app_brand="Harbor Light", label_brand="Harbor Light",
         class_type="American Pale Ale",
         abv=5.0, abv_label=5.2,
         net="12 FL OZ",
         addr="Harbor Light Brewing Co., 220 Wharf St, Portland, ME 04101",
         is_import=False, coo=None,
         warning=WARNING_STD, warning_caps=True,
         expected="pass — ABV off by 0.2 (within +/-0.3 tolerance)"),
    dict(id="warning-reworded", product="wine",
         app_brand="Willow Creek Vineyards", label_brand="Willow Creek Vineyards",
         class_type="Cabernet Sauvignon",
         abv=13.5, abv_label=13.5,
         net="750 mL",
         addr="Willow Creek Vineyards, 4521 Vine Row, Napa, CA 94558",
         is_import=False, coo=None,
         warning=WARNING_STD.replace("may cause health problems", "may cause serious health problems"),
         warning_caps=True,
         expected="fail — warning reworded (one word added)"),
    dict(id="warning-lowercase", product="spirits",
         app_brand="Copper Fox Gin", label_brand="Copper Fox Gin",
         class_type="Distilled Gin",
         abv=47, abv_label=47,
         net="750 mL",
         addr="Copper Fox Distillers, 19 Foundry Ln, Denver, CO 80202",
         is_import=False, coo=None,
         warning=WARNING_STD, warning_caps=False,
         expected="fail — 'Government Warning:' not in ALL CAPS"),
    dict(id="address-mismatch", product="beer",
         app_brand="Northbound Brewing", label_brand="Northbound Brewing",
         class_type="India Pale Ale",
         abv=6.5, abv_label=6.5,
         net="12 FL OZ",
         addr="Northbound Brewing Co., 900 Dock St, Seattle, WA 98134",
         addr_label="Northbound Brewing Co., 900 Dock St, Tacoma, WA 98402",
         is_import=False, coo=None,
         warning=WARNING_STD, warning_caps=True,
         expected="fail — label city/state/ZIP differs from application"),
    dict(id="import-missing-origin", product="wine",
         app_brand="Chateau Meridien", label_brand="Chateau Meridien",
         class_type="Bordeaux Red Blend",
         abv=13, abv_label=13,
         net="750 mL",
         addr="Imported by Meridien Imports LLC, 12 Harbor St, Newark, NJ 07102",
         is_import=True, coo="France", coo_label=None,
         warning=WARNING_STD, warning_caps=True,
         expected="fail — import with no country of origin printed on label"),
    dict(id="class-qualifier-drop", product="spirits",
         app_brand="Ironwood Reserve", label_brand="Ironwood Reserve",
         class_type="Kentucky Straight Bourbon Whiskey",
         class_type_label="Kentucky Bourbon Whiskey",
         abv=43, abv_label=43,
         net="750 mL",
         addr="Ironwood Distilling Co., 77 Barrel Row, Frankfort, KY 40601",
         is_import=False, coo=None,
         warning=WARNING_STD, warning_caps=True,
         expected="review — 'Straight' qualifier dropped on label"),
    dict(id="class-type-reorder", product="wine",
         app_brand="Blue Hollow Cellars", label_brand="Blue Hollow Cellars",
         class_type="Chardonnay White Wine",
         class_type_label="White Wine, Chardonnay",
         abv=12.5, abv_label=12.5,
         net="750 mL",
         addr="Blue Hollow Cellars, 310 Ridge Rd, Sonoma, CA 95476",
         is_import=False, coo=None,
         warning=WARNING_STD, warning_caps=True,
         expected="review — class/type word order changed"),
    dict(id="blurry-unreadable", product="spirits",
         app_brand="STONE'S THROW", label_brand="Stone's Throw",
         class_type="Kentucky Straight Bourbon Whiskey",
         abv=45, abv_label=45,
         net="750 mL",
         addr="Stone's Throw Distilling Co., 412 River Road, Bardstown, KY 40004",
         is_import=False, coo=None,
         warning=WARNING_STD, warning_caps=True,
         degrade=True,
         expected="unreadable — heavy blur; extraction should report low confidence, not a verdict"),
    # --- Day 6: fresh edge cases, not tuned against during Days 2-5 ---
    dict(id="address-abbrev-ok", product="spirits",
         app_brand="Hollow Oak", label_brand="Hollow Oak",
         class_type="Kentucky Straight Bourbon Whiskey",
         abv=46, abv_label=46,
         net="750 mL",
         addr="Hollow Oak Distillery, 900 Mill Creek Road, Lexington, KY 40507",
         addr_label="Hollow Oak Distillery, 900 Mill Creek Rd., Lexington, KY 40507",
         is_import=False, coo=None,
         warning=WARNING_STD, warning_caps=True,
         expected="pass — street abbreviated (Road -> Rd.), same address"),
    dict(id="import-with-origin-ok", product="wine",
         app_brand="Villa Serena", label_brand="Villa Serena",
         class_type="Chianti Classico",
         abv=13.5, abv_label=13.5,
         net="750 mL",
         addr="Imported by Serena Wine Imports LLC, 40 Front St, Brooklyn, NY 11201",
         is_import=True, coo="Italy",
         warning=WARNING_STD, warning_caps=True,
         expected="pass — import with 'Product of Italy' printed"),
    dict(id="brand-extra-word", product="beer",
         app_brand="Harbor Light", label_brand="Harbor Light Reserve",
         class_type="American Pale Ale",
         abv=5.6, abv_label=5.6,
         net="12 FL OZ",
         addr="Harbor Light Brewing Co., 220 Wharf St, Portland, ME 04101",
         is_import=False, coo=None,
         warning=WARNING_STD, warning_caps=True,
         expected="review — label adds 'Reserve' to the brand name"),
    dict(id="net-contents-unit-diff", product="beer",
         app_brand="Tidewater Lager", label_brand="Tidewater Lager",
         class_type="American Lager",
         abv=4.8, abv_label=4.8,
         net="750 mL", net_label="0.75 L",
         addr="Tidewater Brewing Co., 5 Bay St, Norfolk, VA 23510",
         is_import=False, coo=None,
         warning=WARNING_STD, warning_caps=True,
         expected="pass — net contents unit differs, same volume"),
]

only = set(sys.argv[1:])  # optional: regenerate just these ids (manifest is always rewritten in full)
manifest = []
for f in FIXTURES:
    manifest.append({"id": f["id"], "product": f["product"], "expected": f["expected"]})
    if only and f["id"] not in only:
        continue
    class_type_app = f.get("class_type")
    class_type_label = f.get("class_type_label", class_type_app)
    addr_label = f.get("addr_label", f["addr"])
    coo_label = f.get("coo_label", f.get("coo"))
    net_label = f.get("net_label", f["net"])

    write_app(
        f["id"], f["product"], f["app_brand"], class_type_app,
        f["abv"], f["net"], f["addr"], f["is_import"], f.get("coo"),
    )
    render(
        f["id"], f["product"], f["label_brand"], class_type_label,
        f["abv_label"], net_label, addr_label, coo_label,
        f["warning"], f["warning_caps"], degrade=f.get("degrade", False),
    )
    print(f"wrote {f['id']}: {f['expected']}")

with open(os.path.join(BASE, "FIXTURE_MANIFEST.json"), "w") as fh:
    json.dump(manifest, fh, indent=2)
    fh.write("\n")

print("done:", len(FIXTURES), "fixtures")
