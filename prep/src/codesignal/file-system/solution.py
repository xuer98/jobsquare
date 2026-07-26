import copy as _copy

class Node:
    def __init__(self, is_dir):
        self.is_dir = is_dir
        self.size = 0
        self.children = {}

class FileSystem:
    def __init__(self):
        self.root = Node(is_dir=True)
    
    def _parts(self, path):
        return [p for p in path.split('/') if p]
    
    def _resolve(self, path):
        node = self.root
        for part in self._parts(path):
            if not node.is_dir or part not in node.children:
                return None
            node = node.children[part]
        return node
    
    def _parent_and_name(self, path):
        parts = self._parts(path)
        if not parts:
            return None, None
        *parent_parts, name = parts
        parent = self.root
        for part in parent_parts:
            if not parent.is_dir or part not in parent.children:
                return None, None
            parent = parent.children[part]
        return (parent, name) if parent.is_dir else (None, None)

    def mkdir(self, timestamp, path):
        parent, name = self._parent_and_name(path)
        if parent is None or name in parent.children:
            return False
        parent.children[name] = Node(is_dir=True)
        return True
    
    def add_file(self, timestamp, path, size):
        parent, name = self._parent_and_name(path)
        if parent is None or name in parent.children:
            return False
        node = Node(is_dir=False)
        node.size = size
        parent.children[name] = node
        return True
    
    def get_file_size(self, timestamp, path):
        node = self._resolve(path)
        if node is None or node.is_dir:
            return None
        return node.size


fs = FileSystem()
assert fs.mkdir(1, "/docs") is True
assert fs.mkdir(2, "/docs/work") is True
assert fs.mkdir(3, "/docs") is False
assert fs.mkdir(4, "/nope/child") is False
assert fs.add_file(5, "/docs/a.txt", 100) is True
assert fs.add_file(6, "/docs/work/b.txt", 200) is True
assert fs.add_file(7, "/docs/work/c.txt", 50) is True
assert fs.add_file(8, "/docs/a.txt", 5) is False
assert fs.get_file_size(9, "/docs/a.txt") == 100
assert fs.get_file_size(10, "/docs/work") is None
assert fs.get_file_size(11, "/missing") is None

# assert fs.get_dir_size(12, "/docs") == 350
# assert fs.get_dir_size(13, "/docs/work") == 250
# assert fs.get_dir_size(14, "/docs/a.txt") is None
# assert fs.find_largest_file(15, "/docs") == "/docs/work/b.txt"
# assert fs.find_largest_file(16, "/docs/work") == "/docs/work/b.txt"

# assert fs.move(17, "/docs/work/c.txt", "/docs/c.txt") is True
# assert fs.get_dir_size(18, "/docs/work") == 200
# assert fs.get_dir_size(19, "/docs") == 350
# assert fs.get_file_size(20, "/docs/c.txt") == 50
# assert fs.move(21, "/docs/work", "/docs/work") is False
# assert fs.move(22, "/docs/work", "/docs/a.txt/sub") is False
# assert fs.move(23, "/docs", "/docs/work/docs") is False

# assert fs.copy(24, "/docs/a.txt", "/docs/a_copy.txt") is True
# assert fs.get_file_size(25, "/docs/a_copy.txt") == 100
# assert fs.get_dir_size(26, "/docs") == 450
# assert fs.mkdir(27, "/backup") is True
# assert fs.copy(28, "/docs/work", "/backup/work") is True
# assert fs.get_dir_size(29, "/backup/work") == 200
# assert fs.get_dir_size(30, "/backup") == 200

# assert fs.find_files_by_size(31, "/docs", 100) == "/docs/a.txt(100), /docs/a_copy.txt(100), /docs/work/b.txt(200)"
# assert fs.find_files_by_size(32, "/docs", 60) == "/docs/a.txt(100), /docs/a_copy.txt(100), /docs/work/b.txt(200)"
# assert fs.find_files_by_size(33, "/", 0) == "/backup/work/b.txt(200), /docs/a.txt(100), /docs/a_copy.txt(100), /docs/c.txt(50), /docs/work/b.txt(200)"
print("all passed")
