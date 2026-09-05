"""PS-001 independent enforcement oracle, content revision 1.2.2.

Derived from the retained independent PS-001 oracle before any new producer
output. Run the immutable packaged script from the inspected fresh candidate
working directory with Python >=3.8 and -B. It reads the candidate; it does not
copy or supply an implementation. A successful run is evidence for these
checks only, not a human acceptance, deployment, or Time Tracker booking.
"""
import copy
import importlib
import itertools
import json
from pathlib import Path
import random
import sys
import unittest

sys.path.insert(0, str(Path.cwd()))
reorder_items = importlib.import_module('stock_alert').reorder_items

class IndependentCriteria(unittest.TestCase):
    def test_a1_a2_exhaustive_threshold_quantity(self):
        for stock, point in itertools.product(range(12), repeat=2):
            with self.subTest(stock=stock, reorder_point=point):
                products = [{'sku': 'A', 'stock': stock, 'reorder_point': point}]
                before = copy.deepcopy(products)
                self.assertEqual(reorder_items(products), [{'sku': 'A', 'quantity': point - stock}] if stock < point else [])
                self.assertEqual(products, before)

    def test_a2_a4_seeded_lexical_order_extra_fields_and_nonmutation(self):
        rng = random.Random(1001)
        skus = ['a', 'A', '東京', 'é', 'Ω', 'Z', 'α', 'a-1', 'SKU.10']
        for _ in range(100):
            rng.shuffle(skus)
            products = [{'sku': s, 'stock': rng.randrange(100), 'reorder_point': rng.randrange(100), 'extra': {'nested': [1, 2]}} for s in skus]
            before = copy.deepcopy(products)
            expected = sorted([{'sku': p['sku'], 'quantity': p['reorder_point'] - p['stock']} for p in products if p['stock'] < p['reorder_point']], key=lambda p: p['sku'])
            actual = reorder_items(products)
            self.assertEqual(actual, expected); self.assertEqual(products, before)
            self.assertIsInstance(actual, list)
            for row in actual: self.assertEqual(set(row), {'sku', 'quantity'}); self.assertIs(type(row['quantity']), int)

    def test_a3_invalid_values_all_or_nothing_no_mutation(self):
        good = {'sku': 'VALID', 'stock': 0, 'reorder_point': 4}
        invalid = []
        for value in ['', ' ', ' A', 'A ', '\tA', 'A\n', '\u00a0A', None, 4, True, [], {}]:
            invalid.append({'sku': value, 'stock': 1, 'reorder_point': 2})
        for field in ['stock', 'reorder_point']:
            for value in [-1, 0.0, 1.1, '2', None, True, False, [], {}]:
                row = {'sku': 'BAD', 'stock': 1, 'reorder_point': 2}; row[field] = value; invalid.append(row)
        for row in invalid:
            with self.subTest(row=row):
                products = [copy.deepcopy(good), row]; before = copy.deepcopy(products)
                with self.assertRaises(ValueError): reorder_items(products)
                self.assertEqual(products, before)

    def test_a3_duplicates_are_case_sensitive_even_when_no_reorder(self):
        with self.assertRaises(ValueError):
            reorder_items([{'sku': 'X', 'stock': 9, 'reorder_point': 1}, {'sku': 'X', 'stock': 9, 'reorder_point': 1}])
        self.assertEqual(reorder_items([{'sku': 'a', 'stock': 0, 'reorder_point': 1}, {'sku': 'A', 'stock': 0, 'reorder_point': 1}]), [{'sku': 'A', 'quantity': 1}, {'sku': 'a', 'quantity': 1}])

    def test_a4_structural_validation_and_empty_list(self):
        for value in [None, {}, (), 'products', 1, True]:
            with self.subTest(value=value):
                with self.assertRaises(ValueError): reorder_items(value)
        for row in [None, [], (), 'row', 5, True, {}, {'sku': 'A'}, {'sku': 'A', 'stock': 0}, {'sku': 'A', 'reorder_point': 2}, {'stock': 0, 'reorder_point': 2}]:
            with self.subTest(row=row):
                with self.assertRaises(ValueError): reorder_items([row])
        self.assertEqual(reorder_items([]), [])

    def test_a1_a2_supplied_input_and_expected_file(self):
        products = json.loads(Path('input.json').read_text())
        expected = [{'sku': 'A-100', 'quantity': 4}, {'sku': 'M-300', 'quantity': 5}]
        self.assertEqual(reorder_items(products), expected)
        self.assertEqual(json.loads(Path('expected.json').read_text()), expected)

    def test_a5_four_usable_artifacts_present(self):
        for name in ['stock_alert.py', 'test_stock_alert.py', 'expected.json', 'USAGE.md']:
            with self.subTest(path=name):
                path = Path(name)
                self.assertTrue(path.is_file(), 'Required deliverable missing: ' + name)
                self.assertGreater(path.stat().st_size, 0, 'Required deliverable empty: ' + name)
        self.assertIn('reorder_items', Path('USAGE.md').read_text(encoding='utf-8'))

if __name__ == '__main__': unittest.main(verbosity=2)
