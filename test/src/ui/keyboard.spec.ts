/*-----------------------------------------------------------------------------
| Copyright (c) 2014-2016, PhosphorJS Contributors
|
| Distributed under the terms of the BSD 3-Clause License.
|
| The full license is in the file LICENSE, distributed with this software.
|----------------------------------------------------------------------------*/
import expect = require('expect.js');

import {
  generate
} from 'simulate-event';

import {
  EN_US, KeycodeLayout
} from '../../../lib/ui/keyboard';


describe('KeyCodeLayout', () => {

  describe('#constructor()', () => {

    it('should construct a new keycode layout', () => {
      let layout = new KeycodeLayout('ab-cd', {});
      expect(layout).to.be.a(KeycodeLayout);
    });

  });

  describe('#name', () => {

    it('should be a human readable name of the layout', () => {
      let layout = new KeycodeLayout('ab-cd', {});
      expect(layout.name).to.be('ab-cd');
    });

    it('should be read-only', () => {
      let layout = new KeycodeLayout('ab-cd', {});
      expect(() => { layout.name = 'ab-cd'; }).to.throwError();
    });

  });

  describe('#keycaps()', () => {

    it('should get an array of all key values supported by the layout', () => {
      let layout = new KeycodeLayout('ab-cd', { 100: 'F' });
      let keys = layout.keys();
      expect(keys.length).to.be(1);
      expect(keys[0]).to.be('F');
    });

  });

  describe('#isValidKeycap()', () => {

    it('should test whether the key is valid for the layout', () => {
      let layout = new KeycodeLayout('foo', { 100: 'F' });
      expect(layout.isValidKey('F')).to.be(true);
      expect(layout.isValidKey('A')).to.be(false);
    });

  });

  describe('#keycapForKeydownEvent()', () => {

    it('should get the keycap for a `keydown` event', () => {
      let layout = new KeycodeLayout('foo', { 100: 'F' });
      let event = generate('keydown', { keyCode: 100 });
      let key = layout.keyForKeydownEvent(event as KeyboardEvent);
      expect(key).to.be('F');
    });

    it('should return an empty string if the code is not valid', () => {
      let layout = new KeycodeLayout('foo', { 100: 'F' });
      let event = generate('keydown', { keyCode: 101 });
      let key = layout.keyForKeydownEvent(event as KeyboardEvent);
      expect(key).to.be('');
    });

  });

});

describe('EN_US', () => {

  it('should be a keycode layout', () => {
    expect(EN_US).to.be.a(KeycodeLayout);
  });

  it('should have standardized keys', () => {
    expect(EN_US.isValidKey('A')).to.be(true);
    expect(EN_US.isValidKey('Z')).to.be(true);
    expect(EN_US.isValidKey('0')).to.be(true);
    expect(EN_US.isValidKey('a')).to.be(false);
  });

});
