from solution import Structure


def test_basic():
    s = Structure(capacity=2)
    assert s is not None


def test_eviction_order():
    """The operation everyone gets wrong. Write this one first."""
    pass


def test_edge_cases():
    """Capacity 0 or 1. Overwriting an existing key. Reading a missing key."""
    pass
