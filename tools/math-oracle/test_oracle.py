"""Self-test for the oracle's own judgement: known pairs must land in known classes.

Run: tools/math-oracle/.venv/bin/python -m unittest tools/math-oracle/test_oracle.py
These pin the oracle, not the engine. The engine's verdicts are supplied by hand.
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(__file__))
import oracle as o  # noqa: E402


def cls(qtype, key, text, engine_correct, family='slip', label='t', feedback=None):
    q = {'type': qtype, 'key': key}
    c = {'family': family, 'label': label, 'input': text}
    v = {'correct': engine_correct, 'invalid': False, 'feedback': feedback}
    return o.classify(q, c, v, o.oracle_status(q, c))


class OracleSelfTest(unittest.TestCase):
    def test_exact_numbers(self):
        self.assertEqual(cls('numeric', {'value': 0.5, 'simplestFraction': {'n': 1, 'd': 2}}, '1/2', True), 'AGREE_ACCEPT')
        self.assertEqual(cls('numeric', {'value': 2.5}, '5/2', True), 'AGREE_ACCEPT')
        self.assertEqual(cls('numeric', {'value': 4.242640687119286, 'surdForm': {'k': 3, 'r': 2}}, '3sqrt(2)', True), 'AGREE_ACCEPT')
        self.assertEqual(cls('numeric', {'value': 7}, '1 1/2', True), 'FALSE_CREDIT')

    def test_false_credit_is_proved_not_sampled(self):
        self.assertEqual(cls('numeric', {'value': 1 / 3}, '0.3', True), 'FALSE_CREDIT')
        self.assertEqual(cls('expression', {'expr': 'x^2'}, 'x^2 + 0.0000001*x', True), 'FALSE_CREDIT')

    def test_exact_demand_refuses_calculator_display(self):
        key = {'value': 2.356194490192345, 'requireExact': True, 'canonicalInput': '3pi/4'}
        self.assertEqual(cls('numeric', key, '2.3561944902', True), 'FALSE_CREDIT')
        self.assertEqual(cls('numeric', key, '3pi/4', True), 'AGREE_ACCEPT')

    def test_rounding_policy(self):
        self.assertEqual(cls('numeric', {'value': 2 ** 0.5}, '1.4142', True), 'AGREE_ACCEPT_APPROX')
        self.assertEqual(cls('numeric', {'value': 2 ** 0.5}, '1.4143', True), 'FALSE_CREDIT')
        self.assertEqual(cls('numeric', {'value': 12}, '11.9999999999', True), 'POLICY_NOISE_OR_DISPLAY')

    def test_form_rule_is_not_a_false_rejection(self):
        key = {'value': 0.5, 'simplestFraction': {'n': 1, 'd': 2}, 'requireFraction': True}
        self.assertEqual(cls('numeric', key, '2/4', False, 'correct', 'unsimplified-fraction', 'not fully simplified'), 'POLICY_FORM_RULE')
        self.assertEqual(cls('numeric', {'value': 5}, '5', False, 'correct', 'canonical'), 'FALSE_REJECTION')

    def test_expression_domain(self):
        self.assertEqual(cls('expression', {'expr': 'x + 1'}, '(x + 1)*x/x', False), 'AGREE_REJECT')
        self.assertEqual(cls('expression', {'expr': 'x + 1'}, '(x + 1)*x/x', True), 'FALSE_CREDIT')
        self.assertEqual(cls('expression', {'expr': 'x^4', 'positiveOnly': True}, '(x^4)*x/x', True), 'AGREE_ACCEPT')
        self.assertEqual(cls('expression', {'expr': '2*ln(x)'}, 'ln(x^2)', True), 'POLICY_DOMAIN_CREDIT')
        self.assertEqual(cls('expression', {'expr': '(x+1)^2'}, 'x^2 + 2x + 1', True), 'AGREE_ACCEPT')
        self.assertEqual(cls('expression', {'expr': '3(x+2)'}, '3x + 2', False), 'AGREE_REJECT')

    def test_constant_of_integration(self):
        key = {'expr': 'x^2', 'stripC': True}
        self.assertEqual(cls('expression', key, 'x^2 + C', True), 'AGREE_ACCEPT')
        self.assertEqual(cls('expression', key, 'x^2', True), 'POLICY_CONSTANT_NOT_REQUIRED')
        self.assertEqual(cls('expression', key, 'x^2 + 5', False), 'AGREE_REJECT_POLICY')

    def test_sets_and_points(self):
        self.assertEqual(cls('set', {'values': [2, -2]}, '-2, 2', True), 'AGREE_ACCEPT')
        self.assertEqual(cls('set', {'values': [2, -2]}, '2, 2', True), 'FALSE_CREDIT')
        self.assertEqual(cls('set', {'values': [2, -2]}, 'x = 2 or x = -2', True), 'AGREE_ACCEPT')
        self.assertEqual(cls('point', {'x': 1, 'y': 2}, '(2, 1)', True), 'FALSE_CREDIT')

    def test_engine_syntax(self):
        self.assertEqual(o.sp.simplify(o.parse('log(100)')), 2)         # log is base 10 in the engine
        self.assertEqual(str(o.parse('0x + -8')), '-8')   # never a hex literal
        self.assertEqual(o.parse('1,234'), 1234)


if __name__ == '__main__':
    unittest.main()
