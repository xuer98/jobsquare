"""Test suite for ICF Mock 1 -- ContentStore.

Run everything:        python3 -m pytest -q
Run one level:         python3 -m pytest -q -m level1
Test your own levels: ICF_IMPL=levels python3 -m pytest -q -m level1
"""

import importlib
import os

import pytest

_impl = importlib.import_module(os.environ.get("ICF_IMPL", "solution"))
ContentStore = _impl.ContentStore


# ======================================================================
# Level 1 -- basic CRUD
# ======================================================================


@pytest.mark.level1
def test_add_then_get_returns_body():
    store = ContentStore()
    assert store.add_content("home-hero", "Belong anywhere", 4200) is True
    assert store.get_content("home-hero") == "Belong anywhere"


@pytest.mark.level1
def test_get_missing_returns_none():
    store = ContentStore()
    assert store.get_content("nope") is None


@pytest.mark.level1
def test_add_duplicate_returns_false_and_does_not_overwrite():
    store = ContentStore()
    store.add_content("home-hero", "v1", 100)
    assert store.add_content("home-hero", "v2", 999) is False
    assert store.get_content("home-hero") == "v1"


@pytest.mark.level1
def test_update_existing_returns_true_and_replaces_body():
    store = ContentStore()
    store.add_content("home-hero", "v1", 100)
    assert store.update_content("home-hero", "v2", 250) is True
    assert store.get_content("home-hero") == "v2"


@pytest.mark.level1
def test_update_missing_returns_false_and_creates_nothing():
    store = ContentStore()
    assert store.update_content("ghost", "v1", 10) is False
    assert store.get_content("ghost") is None


@pytest.mark.level1
def test_delete_existing_returns_true_and_hides_content():
    store = ContentStore()
    store.add_content("home-hero", "v1", 100)
    assert store.delete_content("home-hero") is True
    assert store.get_content("home-hero") is None


@pytest.mark.level1
def test_delete_missing_returns_false():
    store = ContentStore()
    assert store.delete_content("ghost") is False


@pytest.mark.level1
def test_delete_is_not_idempotent_second_call_returns_false():
    store = ContentStore()
    store.add_content("a", "v1", 1)
    assert store.delete_content("a") is True
    assert store.delete_content("a") is False


@pytest.mark.level1
def test_readd_after_delete_succeeds():
    store = ContentStore()
    store.add_content("a", "v1", 1)
    store.delete_content("a")
    assert store.add_content("a", "v2", 2) is True
    assert store.get_content("a") == "v2"


@pytest.mark.level1
def test_update_after_delete_returns_false():
    store = ContentStore()
    store.add_content("a", "v1", 1)
    store.delete_content("a")
    assert store.update_content("a", "v2", 2) is False


@pytest.mark.level1
def test_ids_are_independent():
    store = ContentStore()
    store.add_content("a", "A", 1)
    store.add_content("b", "B", 2)
    store.delete_content("a")
    assert store.get_content("a") is None
    assert store.get_content("b") == "B"


@pytest.mark.level1
def test_empty_body_and_zero_size_are_legal():
    store = ContentStore()
    assert store.add_content("blank", "", 0) is True
    assert store.get_content("blank") == ""


# ======================================================================
# Level 2 -- prefix search and top-N ranking
# ======================================================================


def _seed_level2() -> ContentStore:
    store = ContentStore()
    store.add_content("home-hero", "Belong anywhere", 4200)
    store.add_content("home-footer", "Legal", 800)
    store.add_content("home-banner", "Summer sale", 4200)
    store.add_content("host-guide", "Hosting 101", 9000)
    return store


@pytest.mark.level2
def test_find_by_prefix_returns_formatted_ids_sorted_ascending():
    store = _seed_level2()
    assert store.find_by_prefix("home-") == [
        "home-banner(4200)",
        "home-footer(800)",
        "home-hero(4200)",
    ]


@pytest.mark.level2
def test_find_by_prefix_empty_prefix_matches_everything():
    store = _seed_level2()
    assert store.find_by_prefix("") == [
        "home-banner(4200)",
        "home-footer(800)",
        "home-hero(4200)",
        "host-guide(9000)",
    ]


@pytest.mark.level2
def test_find_by_prefix_no_match_returns_empty_list():
    store = _seed_level2()
    assert store.find_by_prefix("zzz") == []


@pytest.mark.level2
def test_find_by_prefix_on_empty_store_returns_empty_list():
    assert ContentStore().find_by_prefix("home-") == []


@pytest.mark.level2
def test_find_by_prefix_excludes_deleted_content():
    store = _seed_level2()
    store.delete_content("home-footer")
    assert store.find_by_prefix("home-") == ["home-banner(4200)", "home-hero(4200)"]


@pytest.mark.level2
def test_find_by_prefix_reflects_updated_size():
    store = _seed_level2()
    store.update_content("home-footer", "Legal v2", 12345)
    assert "home-footer(12345)" in store.find_by_prefix("home-")


@pytest.mark.level2
def test_find_by_prefix_matches_full_id_exactly():
    store = _seed_level2()
    assert store.find_by_prefix("host-guide") == ["host-guide(9000)"]


@pytest.mark.level2
def test_top_n_by_size_orders_by_size_descending():
    store = _seed_level2()
    assert store.top_n_by_size("", 2) == ["host-guide(9000)", "home-banner(4200)"]


@pytest.mark.level2
def test_top_n_by_size_breaks_ties_lexicographically_by_id():
    store = _seed_level2()
    assert store.top_n_by_size("home-", 2) == [
        "home-banner(4200)",
        "home-hero(4200)",
    ]


@pytest.mark.level2
def test_top_n_by_size_with_n_larger_than_match_count_returns_all():
    store = _seed_level2()
    assert store.top_n_by_size("host-", 50) == ["host-guide(9000)"]


@pytest.mark.level2
def test_top_n_by_size_with_non_positive_n_returns_empty_list():
    store = _seed_level2()
    assert store.top_n_by_size("home-", 0) == []
    assert store.top_n_by_size("home-", -3) == []


@pytest.mark.level2
def test_top_n_by_size_prefix_matching_nothing_returns_empty_list():
    store = _seed_level2()
    assert store.top_n_by_size("nope", 5) == []


@pytest.mark.level2
def test_top_n_by_size_excludes_deleted_content():
    store = _seed_level2()
    store.delete_content("host-guide")
    assert store.top_n_by_size("", 1) == ["home-banner(4200)"]


# ======================================================================
# Level 3 -- explicit timestamps and TTL
# ======================================================================


@pytest.mark.level3
def test_add_at_and_get_at_round_trip():
    store = ContentStore()
    assert store.add_content_at(10, "a", "A", 100, ttl=50) is True
    assert store.get_content_at(10, "a") == "A"


@pytest.mark.level3
def test_content_is_invisible_before_its_add_timestamp():
    store = ContentStore()
    store.add_content_at(10, "a", "A", 100)
    assert store.get_content_at(9, "a") is None


@pytest.mark.level3
def test_ttl_boundary_is_alive_at_start_and_dead_exactly_at_expiry():
    store = ContentStore()
    store.add_content_at(10, "a", "A", 100, ttl=5)
    assert store.get_content_at(10, "a") == "A"  # t
    assert store.get_content_at(14, "a") == "A"  # t + ttl - 1
    assert store.get_content_at(15, "a") is None  # t + ttl
    assert store.get_content_at(16, "a") is None


@pytest.mark.level3
def test_ttl_none_never_expires():
    store = ContentStore()
    store.add_content_at(0, "a", "A", 1, ttl=None)
    assert store.get_content_at(10**9, "a") == "A"


@pytest.mark.level3
def test_non_positive_ttl_is_dead_on_arrival():
    store = ContentStore()
    assert store.add_content_at(10, "a", "A", 1, ttl=0) is True
    assert store.get_content_at(10, "a") is None


@pytest.mark.level3
def test_negative_ttl_is_dead_on_arrival():
    store = ContentStore()
    assert store.add_content_at(10, "a", "A", 1, ttl=-5) is True
    assert store.get_content_at(10, "a") is None
    assert store.get_content_at(20, "a") is None


@pytest.mark.level3
def test_add_over_expired_id_succeeds_and_resurrects():
    store = ContentStore()
    store.add_content_at(0, "a", "v1", 1, ttl=5)
    assert store.add_content_at(5, "a", "v2", 2, ttl=5) is True
    assert store.get_content_at(5, "a") == "v2"


@pytest.mark.level3
def test_add_over_live_id_returns_false():
    store = ContentStore()
    store.add_content_at(0, "a", "v1", 1, ttl=5)
    assert store.add_content_at(4, "a", "v2", 2, ttl=5) is False
    assert store.get_content_at(4, "a") == "v1"


@pytest.mark.level3
def test_update_renews_ttl_from_update_timestamp():
    store = ContentStore()
    store.add_content_at(0, "p", "v1", 10, ttl=10)  # would expire at 10
    assert store.update_content_at(9, "p", "v2", 20) is True
    assert store.get_content_at(10, "p") == "v2"  # rescued
    assert store.get_content_at(18, "p") == "v2"  # 9 + 10 - 1
    assert store.get_content_at(19, "p") is None  # 9 + 10


@pytest.mark.level3
def test_update_can_override_the_ttl_duration():
    store = ContentStore()
    store.add_content_at(0, "p", "v1", 10, ttl=10)
    store.update_content_at(5, "p", "v2", 20, ttl=100)
    assert store.get_content_at(104, "p") == "v2"
    assert store.get_content_at(105, "p") is None


@pytest.mark.level3
def test_update_keeps_never_expiring_content_never_expiring():
    store = ContentStore()
    store.add_content_at(0, "p", "v1", 10, ttl=None)
    assert store.update_content_at(5, "p", "v2", 20) is True
    assert store.get_content_at(10**9, "p") == "v2"


@pytest.mark.level3
def test_update_on_expired_content_returns_false_and_does_not_resurrect():
    store = ContentStore()
    store.add_content_at(0, "p", "v1", 10, ttl=10)
    assert store.update_content_at(10, "p", "v2", 20) is False
    assert store.get_content_at(10, "p") is None


@pytest.mark.level3
def test_delete_at_hides_content_and_delete_of_expired_returns_false():
    store = ContentStore()
    store.add_content_at(0, "a", "A", 1, ttl=10)
    store.add_content_at(0, "b", "B", 1, ttl=3)
    assert store.delete_content_at(2, "a") is True
    assert store.get_content_at(2, "a") is None
    assert store.delete_content_at(5, "b") is False


@pytest.mark.level3
def test_find_by_prefix_at_hides_expired_content():
    store = ContentStore()
    store.add_content_at(0, "home-hero", "H", 4200, ttl=10)
    store.add_content_at(0, "home-footer", "F", 800, ttl=100)
    assert store.find_by_prefix_at(9, "home-") == [
        "home-footer(800)",
        "home-hero(4200)",
    ]
    assert store.find_by_prefix_at(10, "home-") == ["home-footer(800)"]


@pytest.mark.level3
def test_top_n_by_size_at_hides_expired_and_keeps_tie_break():
    store = ContentStore()
    store.add_content_at(0, "home-hero", "H", 4200, ttl=10)
    store.add_content_at(0, "home-banner", "B", 4200, ttl=100)
    store.add_content_at(0, "home-footer", "F", 9000, ttl=5)
    assert store.top_n_by_size_at(0, "home-", 3) == [
        "home-footer(9000)",
        "home-banner(4200)",
        "home-hero(4200)",
    ]
    assert store.top_n_by_size_at(10, "home-", 3) == ["home-banner(4200)"]


@pytest.mark.level3
def test_updated_size_is_visible_to_timestamped_queries():
    store = ContentStore()
    store.add_content_at(0, "a", "v1", 10, ttl=100)
    store.update_content_at(5, "a", "v2", 77)
    assert store.find_by_prefix_at(5, "a") == ["a(77)"]


@pytest.mark.level3
def test_logical_clock_tracks_the_largest_timestamp_seen():
    store = ContentStore()
    assert store.current_time() == 0
    store.add_content_at(10, "a", "A", 1)
    assert store.current_time() == 10
    store.get_content_at(42, "a")
    assert store.current_time() == 42
    store.get_content_at(7, "a")
    assert store.current_time() == 42


# ======================================================================
# Level 4 -- history, point-in-time reads, rollback
# ======================================================================


@pytest.mark.level4
def test_get_content_at_time_returns_the_body_of_that_era():
    store = ContentStore()
    store.add_content_at(10, "c", "v1", 100)
    store.update_content_at(20, "c", "v2", 200)
    assert store.get_content_at_time("c", 15) == "v1"
    assert store.get_content_at_time("c", 25) == "v2"
    assert store.get_content_at_time("c", 20) == "v2"


@pytest.mark.level4
def test_get_content_at_time_before_creation_is_none():
    store = ContentStore()
    store.add_content_at(10, "c", "v1", 100)
    assert store.get_content_at_time("c", 9) is None
    assert store.get_content_at_time("missing", 10**6) is None


@pytest.mark.level4
def test_get_content_at_time_sees_across_a_delete():
    store = ContentStore()
    store.add_content_at(10, "c", "v1", 100)
    store.delete_content_at(20, "c")
    assert store.get_content_at_time("c", 19) == "v1"
    assert store.get_content_at_time("c", 20) is None


@pytest.mark.level4
def test_get_content_at_time_respects_expiry():
    store = ContentStore()
    store.add_content_at(10, "c", "v1", 100, ttl=5)
    assert store.get_content_at_time("c", 14) == "v1"
    assert store.get_content_at_time("c", 15) is None


@pytest.mark.level4
def test_get_content_at_time_does_not_advance_the_clock():
    store = ContentStore()
    store.add_content_at(10, "c", "v1", 100)
    store.get_content_at_time("c", 10**6)
    assert store.current_time() == 10


@pytest.mark.level4
def test_rollback_discards_operations_newer_than_the_target():
    store = ContentStore()
    store.add_content_at(10, "x", "X", 1)
    store.add_content_at(20, "y", "Y", 2)
    assert store.rollback(15) == 1
    assert store.get_content_at(30, "x") == "X"
    assert store.get_content_at(30, "y") is None
    assert store.find_by_prefix_at(30, "") == ["x(1)"]


@pytest.mark.level4
def test_rollback_erases_the_history_of_discarded_content():
    store = ContentStore()
    store.add_content_at(10, "x", "X", 1)
    store.add_content_at(20, "y", "Y", 2)
    store.rollback(15)
    assert store.get_content_at_time("y", 20) is None
    assert store.get_content_at_time("x", 12) == "X"


@pytest.mark.level4
def test_rollback_reverts_an_update_to_the_older_body():
    store = ContentStore()
    store.add_content_at(10, "c", "v1", 100)
    store.update_content_at(30, "c", "v2", 900)
    assert store.rollback(20) == 1
    assert store.get_content_at(30, "c") == "v1"
    assert store.find_by_prefix_at(30, "c") == ["c(100)"]


@pytest.mark.level4
def test_rollback_shifts_surviving_ttls_by_the_rewound_interval():
    store = ContentStore()
    store.add_content_at(10, "a", "A", 100, ttl=50)  # expires at 60
    store.add_content_at(20, "b", "B", 200, ttl=5)  # expires at 25
    assert store.get_content_at(40, "a") == "A"
    assert store.get_content_at(40, "b") is None
    assert store.current_time() == 40

    assert store.rollback(20) == 2  # delta = 40 - 20 = 20

    # b had 5 ticks of life left at t=20, so it lives until 40 + 5 = 45.
    assert store.get_content_at(44, "b") == "B"
    assert store.get_content_at(45, "b") is None
    # a had 40 ticks left at t=20, so it lives until 40 + 40 = 80.
    assert store.get_content_at(79, "a") == "A"
    assert store.get_content_at(80, "a") is None


@pytest.mark.level4
def test_rollback_does_not_shift_content_without_a_ttl():
    store = ContentStore()
    store.add_content_at(10, "a", "A", 1, ttl=None)
    store.get_content_at(100, "a")
    assert store.rollback(50) == 1
    assert store.get_content_at(10**9, "a") == "A"


@pytest.mark.level4
def test_rollback_to_before_anything_existed_empties_the_store():
    store = ContentStore()
    store.add_content_at(10, "a", "A", 1)
    store.add_content_at(20, "b", "B", 2)
    assert store.rollback(0) == 0
    assert store.find_by_prefix_at(100, "") == []
    assert store.get_content_at(100, "a") is None
    assert store.get_content_at_time("a", 10) is None


@pytest.mark.level4
def test_rollback_to_the_present_or_future_is_a_no_op():
    store = ContentStore()
    store.add_content_at(10, "a", "A", 1)
    store.add_content_at(20, "b", "B", 2)
    assert store.rollback(20) == 2
    assert store.rollback(999) == 2
    assert store.find_by_prefix_at(20, "") == ["a(1)", "b(2)"]


@pytest.mark.level4
def test_rollback_does_not_move_the_clock_backwards():
    store = ContentStore()
    store.add_content_at(10, "a", "A", 1)
    store.get_content_at(40, "a")
    assert store.current_time() == 40
    store.rollback(20)
    assert store.current_time() == 40


@pytest.mark.level4
def test_rollback_returns_the_count_live_now_not_at_the_target():
    store = ContentStore()
    store.add_content_at(10, "a", "A", 1, ttl=40)  # expires at 50
    store.get_content_at(40, "a")  # clock -> 40, "a" still live
    # At t=100 "a" is long expired, but the count is taken at now = 40.
    assert store.rollback(100) == 1


@pytest.mark.level4
def test_historical_read_inside_the_rolled_back_window_sees_the_gap():
    store = ContentStore()
    store.add_content_at(20, "b", "B1", 200, ttl=5)  # expires at 25
    store.get_content_at(40, "b")  # clock -> 40
    assert store.rollback(20) == 1
    assert store.get_content_at_time("b", 30) is None  # gap in the history
    assert store.get_content_at(44, "b") == "B1"  # but live at now + 5


@pytest.mark.level4
def test_rollback_on_an_empty_store_returns_zero():
    store = ContentStore()
    assert store.rollback(5) == 0


@pytest.mark.level4
def test_mutations_continue_normally_after_a_rollback():
    store = ContentStore()
    store.add_content_at(10, "a", "A", 100, ttl=50)
    store.get_content_at(40, "a")
    store.rollback(20)  # a now expires at 80

    assert store.update_content_at(50, "a", "A2", 150) is True
    assert store.get_content_at(99, "a") == "A2"  # renewed: 50 + 50
    assert store.get_content_at(100, "a") is None
    assert store.add_content_at(100, "a", "A3", 5) is True
    assert store.get_content_at(100, "a") == "A3"


@pytest.mark.level4
def test_rollback_then_rollback_again():
    store = ContentStore()
    store.add_content_at(10, "a", "A", 1)
    store.add_content_at(20, "b", "B", 2)
    store.add_content_at(30, "c", "C", 3)
    assert store.rollback(25) == 2
    assert store.rollback(15) == 1
    assert store.find_by_prefix_at(30, "") == ["a(1)"]


# ---------------------------------------------------------------- #
# Backward compatibility: Levels 1 and 2 must still behave exactly. #
# ---------------------------------------------------------------- #


@pytest.mark.level4
def test_backward_compat_level1_crud_still_works():
    store = ContentStore()
    assert store.add_content("home-hero", "Belong anywhere", 4200) is True
    assert store.get_content("home-hero") == "Belong anywhere"
    assert store.add_content("home-hero", "dup", 1) is False
    assert store.update_content("home-hero", "v2", 250) is True
    assert store.get_content("home-hero") == "v2"
    assert store.delete_content("home-hero") is True
    assert store.get_content("home-hero") is None
    assert store.delete_content("home-hero") is False
    assert store.update_content("home-hero", "v3", 1) is False


@pytest.mark.level4
def test_backward_compat_level2_queries_still_work():
    store = _seed_level2()
    assert store.find_by_prefix("home-") == [
        "home-banner(4200)",
        "home-footer(800)",
        "home-hero(4200)",
    ]
    assert store.top_n_by_size("home-", 2) == [
        "home-banner(4200)",
        "home-hero(4200)",
    ]
    assert store.top_n_by_size("", 1) == ["host-guide(9000)"]
    assert store.find_by_prefix("zzz") == []


@pytest.mark.level4
def test_backward_compat_level1_content_never_expires():
    store = ContentStore()
    store.add_content("a", "A", 1)
    assert store.get_content_at_time("a", 10**9) == "A"


@pytest.mark.level4
def test_legacy_and_timestamped_apis_coexist():
    store = ContentStore()
    store.add_content("a", "A", 1)  # written at t=0
    store.add_content_at(5, "b", "B", 2, ttl=3)  # written at t=5

    # The legacy API reads at t=0, where "b" does not exist yet.
    assert store.get_content("a") == "A"
    assert store.get_content("b") is None
    assert store.find_by_prefix("") == ["a(1)"]

    # The timestamped API sees both while "b" is live.
    assert store.get_content_at(5, "b") == "B"
    assert store.find_by_prefix_at(5, "") == ["a(1)", "b(2)"]
    assert store.find_by_prefix_at(8, "") == ["a(1)"]
