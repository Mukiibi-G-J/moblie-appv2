"""Align 64-bit ELF shared libraries to 16 KB pages.

Google Play rejects arm64/x86_64 libraries whose PT_LOAD alignment is 4 KB.
React Native 0.76 ships those prebuilt libraries. This rewrites file offsets
so every LOAD segment stays congruent with its virtual address at 16 KB, which
is what the loader requires on 16 KB devices.
"""
import os
import struct
import sys

PAGE = 16384
PT_LOAD = 1


def u16(buf, off):
    return struct.unpack_from("<H", buf, off)[0]


def u32(buf, off):
    return struct.unpack_from("<I", buf, off)[0]


def u64(buf, off):
    return struct.unpack_from("<Q", buf, off)[0]


def p16(buf, off, value):
    struct.pack_into("<H", buf, off, value)


def p32(buf, off, value):
    struct.pack_into("<I", buf, off, value)


def p64(buf, off, value):
    struct.pack_into("<Q", buf, off, value)


def shift_for(offset, insertions):
    return sum(pad for at, pad in insertions if at <= offset)


def align_elf(data):
    if data[:4] != b"\x7fELF" or data[4] != 2 or data[5] != 1:
        return data, False
    buf = bytearray(data)
    e_phoff = u64(buf, 32)
    e_shoff = u64(buf, 40)
    e_phentsize = u16(buf, 54)
    e_phnum = u16(buf, 56)
    e_shentsize = u16(buf, 58)
    e_shnum = u16(buf, 60)

    loads = []
    for i in range(e_phnum):
        off = e_phoff + i * e_phentsize
        if u32(buf, off) == PT_LOAD:
            loads.append((i, u64(buf, off + 8), u64(buf, off + 16), u64(buf, off + 48)))
    loads.sort(key=lambda item: item[1])

    insertions = []
    running = 0
    for _, p_offset, p_vaddr, _p_align in loads:
        new_off = p_offset + running
        mis = (p_vaddr - new_off) % PAGE
        if mis:
            insertions.append((p_offset, mis))
            running += mis
    needs_align = any(p_align < PAGE for _, _, _, p_align in loads)
    if not insertions and not needs_align:
        return data, False

    out = bytearray()
    cursor = 0
    for at, pad in insertions:
        out += buf[cursor:at]
        out += b"\x00" * pad
        cursor = at
    out += buf[cursor:]

    def patch_phdr(index):
        base = e_phoff + index * e_phentsize
        p_offset = u64(out, base + 8)
        p64(out, base + 8, p_offset + shift_for(p_offset, insertions))
        if u32(out, base) == PT_LOAD:
            p64(out, base + 48, max(u64(out, base + 48), PAGE))

    # Program headers stay put because they live in the first LOAD at offset 0.
    for i in range(e_phnum):
        patch_phdr(i)

    new_shoff = e_shoff + shift_for(e_shoff, insertions)
    p64(out, 40, new_shoff)
    for i in range(e_shnum):
        base = new_shoff + i * e_shentsize
        sh_offset = u64(out, base + 24)
        p64(out, base + 24, sh_offset + shift_for(sh_offset, insertions))
    return bytes(out), True


def load_aligns(data):
    e_phoff = u64(data, 32)
    e_phentsize = u16(data, 54)
    e_phnum = u16(data, 56)
    rows = []
    for i in range(e_phnum):
        off = e_phoff + i * e_phentsize
        if u32(data, off) != PT_LOAD:
            continue
        p_offset = u64(data, off + 8)
        p_vaddr = u64(data, off + 16)
        p_align = u64(data, off + 48)
        rows.append((p_offset, p_vaddr, p_align, (p_offset - p_vaddr) % PAGE))
    return rows


def align_tree(root):
    changed = 0
    for dirpath, _, filenames in os.walk(root):
        abi = os.path.basename(dirpath)
        if abi not in ("arm64-v8a", "x86_64"):
            continue
        for name in filenames:
            if not name.endswith(".so"):
                continue
            path = os.path.join(dirpath, name)
            with open(path, "rb") as handle:
                original = handle.read()
            updated, did = align_elf(original)
            if not did:
                continue
            rows = load_aligns(updated)
            if any(align < PAGE or cong for _, _, align, cong in rows):
                raise SystemExit(f"alignment failed: {path} {rows}")
            with open(path, "wb") as handle:
                handle.write(updated)
            changed += 1
    print(f"aligned {changed} libraries under {root}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("usage: align_16kb_elf.py <stripped-native-libs-dir>")
    align_tree(sys.argv[1])
