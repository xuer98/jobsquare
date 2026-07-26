# Algorithms

Foldered by **pattern**, not by problem name or by LeetCode number. You are trying to
build recall for "this smells like a sliding window", which only happens if the shelf is
organized that way.

| Pattern | Trigger phrase in the prompt |
| --- | --- |
| `arrays-hashing` | "seen before", counts, anagram, dedupe |
| `two-pointers` | sorted input, pair sums, in-place partition |
| `sliding-window` | "contiguous subarray/substring", "at most k" |
| `binary-search` | sorted, or a monotonic predicate over the answer space |
| `linked-list` | reverse, cycle, merge, reorder |
| `trees` | DFS/BFS, LCA, serialize, BST invariants |
| `tries` | prefix, autocomplete, word search |
| `heap` | top-k, k-way merge, running median, scheduling |
| `backtracking` | permutations, combinations, sudoku, "all valid" |
| `graphs` | grid islands, topo sort, Dijkstra, union-find |
| `intervals` | merge, insert, meeting rooms, sweep line |
| `dp` | "number of ways", "min/max cost", overlapping subproblems |
| `greedy` | local choice provably optimal — must state the exchange argument |
| `bit-math` | XOR tricks, masks, base conversion, overflow |

Add a problem with `./new algo <pattern>/<problem-name>`. If you can't decide which
pattern a problem belongs to, that indecision is the thing worth writing down in its
README. Need a pattern that isn't here? `mkdir src/algo/<pattern>` and `./new` picks it up.
