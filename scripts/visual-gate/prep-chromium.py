"""Decompress @sparticuz/chromium's brotli archives into .verify/."""
import brotli, pathlib, sys

bin_dir = pathlib.Path("node_modules/@sparticuz/chromium/bin")
out = pathlib.Path(".verify")
lib = out / "lib"
lib.mkdir(parents=True, exist_ok=True)

# chromium.br -> executable
target = out / "chromium"
with open(bin_dir / "chromium.br", "rb") as f:
    target.write_bytes(brotli.decompress(f.read()))
target.chmod(0o755)
print("chromium", target, target.stat().st_size)

for name in ("al2023.tar.br", "fonts.tar.br", "swiftshader.tar.br"):
    src = bin_dir / name
    if not src.exists():
        continue
    dst = out / name.replace(".br", "")
    with open(src, "rb") as f:
        dst.write_bytes(brotli.decompress(f.read()))
    print("wrote", dst)
