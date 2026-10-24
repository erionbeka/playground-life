import os
from PIL import Image

possible_sources = [
    "Gemini_Generated_Image_1lgi431lgi431lgi.jpg",
    "icon.png",
    "icon.jpg",
    "public/pwa-512.png",
    "public/pwa-maskable-512.png"
]

source_image_path = None
for path in possible_sources:
    if os.path.exists(path):
        source_image_path = path
        break

if not source_image_path:
    for f in os.listdir("."):
        if f.startswith("Gemini_Generated_Image") and (f.endswith(".jpg") or f.endswith(".png")):
            source_image_path = f
            break

if not source_image_path:
    raise FileNotFoundError("No source icon found!")

print(f"Using source icon (filling entire icon): {source_image_path}")
img = Image.open(source_image_path).convert("RGBA")

densities = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192
}

res_dir = "android/app/src/main/res"

for density, size in densities.items():
    target_folder = os.path.join(res_dir, density)
    os.makedirs(target_folder, exist_ok=True)

    # Resize directly to fill 100% of the icon size with high quality LANCZOS
    resized = img.resize((size, size), Image.Resampling.LANCZOS)

    for name in ["ic_launcher.png", "ic_launcher_round.png", "ic_launcher_foreground.png"]:
        path = os.path.join(target_folder, name)
        resized.save(path, "PNG", optimize=True)
        print(f"Generated full-bleed icon {path} ({size}x{size})")

print("Full-bleed icon generation completed successfully!")
