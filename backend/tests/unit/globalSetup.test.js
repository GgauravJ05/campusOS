'use strict';

const { isDisposableDatabase } = require('../globalSetup');

describe('isDisposableDatabase (the guard on the test-database reset)', () => {
  it.each([
    'postgresql://postgres:postgres@localhost:5432/campusos_test',
    'postgresql://postgres@localhost:55432/campusos_test',
    'postgres://u:p@db.example.com/anything_test?sslmode=require',
  ])('allows %s', (url) => expect(isDisposableDatabase(url)).toBe(true));

  it.each([
    'postgresql://postgres@localhost:55432/campusos',
    'postgresql://postgres@localhost:55432/campusos_demo',
    'postgresql://postgres@localhost:55432/campusos_test_backup',
    'postgresql://postgres@localhost:55432/test',
    'postgresql://postgres@localhost:55432/',
    'postgresql://postgres@localhost:55432',
    'not a url',
    '',
    undefined,
  ])('refuses %p', (url) => expect(isDisposableDatabase(url)).toBe(false));
});
