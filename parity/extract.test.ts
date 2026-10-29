import { expect, test } from "bun:test";

import { doctestsIn, unitTestsIn } from "./extract.ts";

const lines = (...source: string[]): string => source.join("\n");

test("doctest ids are the module path plus the qualified name", () => {
  const source = lines(
    '"""Module.',
    "",
    ">>> 1",
    '"""',
    "class State:",
    '    """State.',
    "",
    "    >>> 2",
    "    >>> 3",
    '    """',
    "    count: int = 0",
    "",
    "    @property",
    "    def street(self):",
    '        """Street.',
    "",
    "        >>> 4",
    '        """',
    "",
    "def rake(amount):",
    '    """Rake.',
    "",
    "    >>> 5",
    "    ...     6",
    '    """'
  );
  expect(doctestsIn("pokerkit/state.py", source)).toEqual([
    { id: "pokerkit.state", file: "pokerkit/state.py", examples: 1 },
    { id: "pokerkit.state.State", file: "pokerkit/state.py", examples: 2 },
    {
      id: "pokerkit.state.State.street",
      file: "pokerkit/state.py",
      examples: 1,
    },
    { id: "pokerkit.state.rake", file: "pokerkit/state.py", examples: 1 },
  ]);
});

test("multi-line headers, column-0 comments and strings keep their scope", () => {
  const source = lines(
    "PATTERN = compile(r'(?!')  # (",
    "class NoLimitTexasHoldem(",
    "    Poker,",
    "):",
    "# a comment at column 0 inside the class",
    "    def create_state(",
    "        cls,",
    "    ) -> State:",
    '        """Create.',
    "",
    "        >>> 1",
    '        """',
    "",
    "def rake(",
    "    amount,",
    ") -> int:",
    '    """Rake.',
    "",
    "    >>> 2",
    "    >>> 3",
    '    """',
    "# >>> not an example"
  );
  expect(doctestsIn("pokerkit/games.py", source)).toEqual([
    {
      id: "pokerkit.games.NoLimitTexasHoldem.create_state",
      file: "pokerkit/games.py",
      examples: 1,
    },
    { id: "pokerkit.games.rake", file: "pokerkit/games.py", examples: 2 },
  ]);
});

test("examples inside a nested function are rejected", () => {
  const source = lines(
    "def outer():",
    "    def inner():",
    '        """',
    "        >>> 1",
    '        """'
  );
  expect(() => doctestsIn("pokerkit/x.py", source)).toThrow(
    "doctest finder skips nested functions"
  );
});

test("unit test ids are module, TestCase and method", () => {
  const source = lines(
    "class StateTestCase(TestCase):",
    "    def test_one(self):",
    "        pass",
    "",
    "    def helper(self):",
    "        pass",
    "",
    "class OtherTestCase(TestCase):",
    "    def test_two(self):",
    "        pass"
  );
  expect(unitTestsIn("pokerkit/tests/test_state.py", source)).toEqual([
    {
      id: "pokerkit.tests.test_state.StateTestCase.test_one",
      file: "pokerkit/tests/test_state.py",
    },
    {
      id: "pokerkit.tests.test_state.OtherTestCase.test_two",
      file: "pokerkit/tests/test_state.py",
    },
  ]);
});
