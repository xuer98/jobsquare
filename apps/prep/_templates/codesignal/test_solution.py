"""Levels are cumulative — L4 tests must not break L1 behavior. Keep them separated
so a failing L3 refactor tells you exactly which level regressed."""

from solution import Service


def test_level_1():
    s = Service()
    assert s is not None


def test_level_2():
    pass


def test_level_3():
    pass


def test_level_4():
    pass
