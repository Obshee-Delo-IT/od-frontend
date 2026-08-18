<?php
/**
 * The three-function test harness both `wp/tests/*.test.php` files use.
 *
 * **Not PHP's own `assert()`.** `zend.assertions` is `-1` on the dev machine and
 * on both servers, which compiles `assert()` out of the file entirely — a test
 * file written with it prints its own «ok» line and exits 0 no matter what the
 * code does, and `assert_options(ASSERT_ACTIVE, 1)` cannot switch it back on.
 * That is not hypothetical: it hid six wrong assertions in the D6e/D6f suite
 * until they were ported onto this helper (2026-08-18). An `if` and an `exit(1)`
 * cannot be disabled by an ini setting.
 *
 * @package od-frontend
 */

declare(strict_types=1);

$passed = 0;

/**
 * @param string $what Description, printed either way.
 * @param bool   $ok   The assertion.
 */
function od_test(string $what, bool $ok): void
{
    global $passed;

    if (!$ok) {
        fwrite(STDERR, "FAIL  {$what}\n");
        exit(1);
    }

    ++$passed;
    echo "ok    {$what}\n";
}

/**
 * `f(f(x)) === f(x)`. Every content transform gets this case: the scripts are
 * re-run on every environment, and possibly after an editor has been in the page.
 *
 * @param callable(string):string $transform
 */
function od_test_idempotent(string $what, callable $transform, string $input): void
{
    $once = $transform($input);
    od_test("{$what}: f(f(x)) === f(x)", $transform($once) === $once);
}

/** Prints the count, so a suite that silently stopped asserting is visible. */
function od_test_summary(): void
{
    global $passed;

    echo "\n{$passed} assertions passed.\n";
}
