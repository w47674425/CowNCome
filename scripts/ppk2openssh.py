#!/usr/bin/env python3
"""ppk 转 OpenSSH 私钥（仅支持 PuTTY-User-Key-File-3, Encryption: none, ssh-rsa）"""
import base64
import struct
import sys

def read_string(buf, off):
    n = struct.unpack(">I", buf[off:off+4])[0]
    off += 4
    return buf[off:off+n], off + n

def read_mpint(buf, off):
    n = struct.unpack(">I", buf[off:off+4])[0]
    off += 4
    data = buf[off:off+n]
    off += n
    # 去前导 0
    data = data.lstrip(b"\x00")
    if not data:
        data = b"\x00"
    return data, off

def write_string(buf, data):
    buf.extend(struct.pack(">I", len(data)))
    buf.extend(data)

def write_mpint(buf, data):
    data = data.lstrip(b"\x00")
    if data[0] & 0x80:
        data = b"\x00" + data
    write_string(buf, data)

def main(ppk_path, out_path):
    with open(ppk_path, "r", encoding="utf-8") as f:
        lines = [l.rstrip("\r\n") for l in f]

    if not lines or not lines[0].startswith("PuTTY-User-Key-File-3"):
        sys.exit("错误: 仅支持 PuTTY-User-Key-File-3 格式")
    algo = lines[0].split(":", 1)[1].strip()
    if algo != "ssh-rsa":
        sys.exit(f"错误: 仅支持 ssh-rsa, 当前 {algo}")

    # 解析头部字段（所有字段行都含 ":"，base64 行不含 ":"）
    fields = {}
    i = 1
    while i < len(lines) and ":" in lines[i]:
        k, v = lines[i].split(":", 1)
        fields[k.strip()] = v.strip()
        i += 1

    if fields.get("Encryption") != "none":
        sys.exit("错误: 私钥已加密(带 passphrase)，无法自动转换")

    pub_b64 = "".join(lines[i:i+int(fields["Public-Lines"])])
    i += int(fields["Public-Lines"])
    priv_b64 = "".join(lines[i:i+int(fields["Private-Lines"])])
    i += int(fields["Private-Lines"])

    pub = base64.b64decode(pub_b64)
    priv = base64.b64decode(priv_b64)

    # 公钥 blob: string "ssh-rsa", mpint e, mpint n
    tag, off = read_string(pub, 0)
    if tag != b"ssh-rsa":
        sys.exit("错误: 公钥算法标记异常")
    e, off = read_mpint(pub, off)
    n, off = read_mpint(pub, off)

    # PuTTY 私钥 blob: string "ssh-rsa", mpint d, mpint p, mpint q, mpint iqmp
    tag2, off2 = read_string(priv, 0)
    if tag2 != b"ssh-rsa":
        sys.exit("错误: 私钥算法标记异常")
    d, off2 = read_mpint(priv, off2)
    p, off2 = read_mpint(priv, off2)
    q, off2 = read_mpint(priv, off2)
    iqmp, off2 = read_mpint(priv, off2)

    comment = fields.get("Comment", "key")

    # 组装 openssh-key-v1
    pub_blob = bytearray()
    write_string(pub_blob, b"ssh-rsa")
    write_mpint(pub_blob, e)
    write_mpint(pub_blob, n)

    priv_blob = bytearray()
    check = 0x1234  # 固定 checkint（无加密场景不影响使用）
    priv_blob.extend(struct.pack(">II", check, check))
    write_string(priv_blob, b"ssh-rsa")
    write_mpint(priv_blob, n)
    write_mpint(priv_blob, e)
    write_mpint(priv_blob, d)
    write_mpint(priv_blob, iqmp)
    write_mpint(priv_blob, p)
    write_mpint(priv_blob, q)
    write_string(priv_blob, comment.encode())
    # 填充到 8 字节块
    pad = 8 - (len(priv_blob) % 8)
    priv_blob.extend(bytes(range(1, pad + 1)))

    out = bytearray()
    out.extend(b"openssh-key-v1\x00")
    write_string(out, b"none")
    write_string(out, b"none")
    write_string(out, b"")
    out.extend(struct.pack(">I", 1))
    write_string(out, bytes(pub_blob))
    write_string(out, bytes(priv_blob))

    b64 = base64.b64encode(bytes(out)).decode()
    with open(out_path, "w", encoding="ascii", newline="\n") as f:
        f.write("-----BEGIN OPENSSH PRIVATE KEY-----\n")
        for j in range(0, len(b64), 70):
            f.write(b64[j:j+70] + "\n")
        f.write("-----END OPENSSH PRIVATE KEY-----\n")

    print(f"OK: 已转换 -> {out_path} (算法 {algo}, 注释 {comment})")

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
