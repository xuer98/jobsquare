---

## In-Memory File System

A unix-style hierarchical file system. `"/"` is root and always exists. Paths look like `"/docs/work/b.txt"`. Directories contain named children (files or subdirectories); files have a size. Timestamps arrive non-decreasing (and aren't semantically used here — the signature just stays consistent with the framework). `None` / `False` / `""` for absent or failed operations.

### Level 1 — Core operations

```
mkdir(timestamp, path) -> bool
    Create a directory. Parent must already exist.
    false if path already exists or the parent is missing/not a dir.

add_file(timestamp, path, size) -> bool
    Create a file with the given size. Parent dir must exist.
    false if path already exists or the parent is missing/not a dir.

get_file_size(timestamp, path) -> int | None
    Size if path is a file; None if it's missing or is a directory.
```

### Level 2 — Aggregation over the tree (reuses L1)

```
get_dir_size(timestamp, path) -> int | None
    Total size of ALL files in the subtree rooted at path.
    Empty directory is 0. None if path isn't a directory.

find_largest_file(timestamp, path) -> string | None
    Full path of the largest file anywhere under path.
    Ties broken by lexicographically smallest path.
    None if path isn't a directory or has no files.
```

### Level 3 — Extend + refactor (the real difficulty)

```
move(timestamp, src, dst) -> bool
    Relocate src (file or dir) so its new full path is dst.
    src must exist; dst must NOT exist; dst's parent must exist.
    Moving a directory relocates its whole subtree.
    Cannot move root, or move a directory into its own subtree.

copy(timestamp, src, dst) -> bool
    Deep-copy src to the new full path dst. Same constraints as move.
    Copying a directory duplicates its entire subtree.
```

The refactor: L1 can walk paths inline, but move/copy each resolve _two_ paths and split a target into (parent, name), so extract `_resolve(path)` and `_parent_and_name(path)` and share them across all six methods. Copy additionally needs recursive subtree cloning.

### Level 4 — Backward-compatible export

```
find_files_by_size(timestamp, path, threshold) -> string
    All files in the subtree under path with size >= threshold, sorted by
    path ascending. Format: "path1(size1), path2(size2), ...". "" if none.
```

### Verified trace

```
mkdir(1, "/docs")                       -> True
mkdir(2, "/docs/work")                  -> True
mkdir(3, "/docs")                       -> False   # exists
mkdir(4, "/nope/child")                 -> False   # parent missing
add_file(5, "/docs/a.txt", 100)         -> True
add_file(6, "/docs/work/b.txt", 200)    -> True
add_file(7, "/docs/work/c.txt", 50)     -> True
add_file(8, "/docs/a.txt", 5)           -> False   # exists
get_file_size(9, "/docs/a.txt")         -> 100
get_file_size(10, "/docs/work")         -> None    # is a dir
get_file_size(11, "/missing")           -> None
get_dir_size(12, "/docs")               -> 350     # 100+200+50
get_dir_size(13, "/docs/work")          -> 250
get_dir_size(14, "/docs/a.txt")         -> None    # not a dir
find_largest_file(15, "/docs")          -> "/docs/work/b.txt"
find_largest_file(16, "/docs/work")     -> "/docs/work/b.txt"
move(17, "/docs/work/c.txt", "/docs/c.txt")  -> True
get_dir_size(18, "/docs/work")          -> 200     # c.txt left
get_dir_size(19, "/docs")               -> 350     # total unchanged
get_file_size(20, "/docs/c.txt")        -> 50
move(21, "/docs/work", "/docs/work")    -> False   # dst exists
move(22, "/docs/work", "/docs/a.txt/sub") -> False # dst parent is a file
move(23, "/docs", "/docs/work/docs")    -> False   # into own subtree
copy(24, "/docs/a.txt", "/docs/a_copy.txt")  -> True
get_file_size(25, "/docs/a_copy.txt")   -> 100
get_dir_size(26, "/docs")               -> 450     # +100 copy
mkdir(27, "/backup")                    -> True
copy(28, "/docs/work", "/backup/work")  -> True    # deep dir copy
get_dir_size(29, "/backup/work")        -> 200
get_dir_size(30, "/backup")             -> 200
find_files_by_size(31, "/docs", 100)    -> "/docs/a.txt(100), /docs/a_copy.txt(100), /docs/work/b.txt(200)"
find_files_by_size(32, "/docs", 60)     -> same (c.txt=50 excluded)
find_files_by_size(33, "/", 0)          -> "/backup/work/b.txt(200), /docs/a.txt(100), /docs/a_copy.txt(100), /docs/c.txt(50), /docs/work/b.txt(200)"
```
