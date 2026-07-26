"""<Problem Name>

Invariants:
    - <the property that holds after every operation>
"""


class Structure:
    def __init__(self, capacity: int) -> None:
        self.capacity = capacity

    def get(self, key):
        raise NotImplementedError

    def put(self, key, value) -> None:
        raise NotImplementedError
