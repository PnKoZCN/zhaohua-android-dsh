# vendor/ —— 沙箱运行时资产（本仓库不含）

这些文件体积大、且与平台相关，因此不进版本库。构建前按下面的步骤准备。

| 文件 | 来源 | 大小 |
|---|---|---|
| `bin/proot` | [termux/proot](https://github.com/termux/proot) 的 Android aarch64 构建（Termux 仓库 `proot` 包，取出 `libexec/proot`） | ~1.3 MB |
| `bin/proot-loader` | 同上（`libproot-loader.so`，静态 ELF） | ~18 KB |
| `bin/libhosdlatalloc.so` | `python3 sandbox/fetch-sandbox-libs.py vendor/bin`（Termux `libtalloc`，改名为 proot 的 DT_NEEDED 名） | ~33 KB |
| `bin/libandroidshmem.so` | 同上（Termux `libandroid-shmem`） | ~14 KB |
| `zh-rootfs.tar.gz` | `sh sandbox/make-rootfs.sh vendor`（Alpine minirootfs + zh-setup） | ~4 MB |
| `zh-setup` | 随 rootfs 一起产出，也会打进 `payload/dshhome/zh-setup` | ~6 KB |
| `zh-extract.py` | 本仓库 `sandbox/zh-extract.py`（无需准备，构建时自动带上） | — |

## 准备步骤

```sh
sh sandbox/make-rootfs.sh vendor
python3 sandbox/fetch-sandbox-libs.py vendor/bin
# 再把 proot 与 proot-loader 放到 vendor/bin/
```

## 取 proot 的简便办法

Termux 的 `proot` 包（`.deb`）里含 aarch64 的 proot 与 loader：

```sh
# 从 Termux 仓库索引找到 proot 包地址，然后用 ar + tar 解出：
ar x proot_*.deb
tar xf data.tar.xz ./data/data/com.termux/files/usr/libexec/proot ./data/data/com.termux/files/usr/lib/libproot-loader.so
cp data/data/com.termux/files/usr/libexec/proot      vendor/bin/proot
cp data/data/com.termux/files/usr/lib/libproot-loader.so vendor/bin/proot-loader
```

> ⚠ 这些二进制是 Termux 编译产物，路径里可能硬编码 `/data/data/com.termux/...`。
> 本项目的调用方式（`PROOT_LOADER` + `PROOT_TMP_DIR` + `LD_LIBRARY_PATH`）已绕开对
> Termux 环境的依赖，无需安装 Termux。

## 许可证

PRoot 与 loader 为 **GPL-2.0**（见 [THIRD_PARTY.md](../THIRD_PARTY.md)）；
talloc 为 LGPL-3.0；libandroid-shmem 为 MIT。它们以独立可执行文件/共享库形式
随 APK 分发，未与本项目 MIT 代码静态链接。再分发时请一并保留许可证文本。
