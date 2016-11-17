/*-----------------------------------------------------------------------------
| Copyright (c) 2014-2016, PhosphorJS Contributors
|
| Distributed under the terms of the BSD 3-Clause License.
|
| The full license is in the file LICENSE, distributed with this software.
|----------------------------------------------------------------------------*/
import {
  ArrayIterator, IArrayLike, IIterable, IIterator
} from './iterable';


/**
 * A sequence of indexable values.
 */
export
interface ISequence<T> extends IIterable<T> {
  /**
   * The length of the sequence.
   */
  readonly length: number;

  /**
   * Get the value at a specific index.
   *
   * @param index - The index of interest.
   *
   * @returns The value at the specified index.
   *
   * #### Undefined Behavior
   * An `index` which is negative, non-integral, or out of range.
   */
  at(index: number): T;
}


/**
 * A sequence which allows mutation of the underlying values.
 */
export
interface IMutableSequence<T> extends ISequence<T> {
  /**
   * Set the value at a specific index.
   *
   * @param index - The index of interest.
   *
   * @param value - The value to set at the specified index.
   *
   * #### Undefined Behavior
   *  An `index` which is negative, non-integral, or out of range.
   */
  set(index: number, value: T): void;
}


/**
 * A type alias for a sequence or builtin array-like object.
 */
export
type Sequence<T> = ISequence<T> | IArrayLike<T>;


/**
 * A type alias for a mutable sequence or builtin array-like object.
 */
export
type MutableSequence<T> = IMutableSequence<T> | IArrayLike<T>;


/**
 * Cast a sequence or array-like object to a sequence.
 *
 * @param object - The sequence or array-like object of interest.
 *
 * @returns A sequence for the given object.
 *
 * #### Notes
 * This function allows sequence algorithms to operate on user-defined
 * sequence types and builtin array-like objects in a uniform fashion.
 */
export
function asSequence<T>(object: Sequence<T>): ISequence<T> {
  let seq: ISequence<T>;
  if (typeof (object as any).at === 'function') {
    seq = object as ISequence<T>;
  } else {
    seq = new ArraySequence<T>(object as IArrayLike<T>);
  }
  return seq;
}


/**
 * Cast a mutable sequence or array-like object to a mutable sequence.
 *
 * @param object - The sequence or array-like object of interest.
 *
 * @returns A mutable sequence for the given object.
 *
 * #### Notes
 * This function allows sequence algorithms to operate on user-defined
 * sequence types and builtin array-like objects in a uniform fashion.
 */
export
function asMutableSequence<T>(object: MutableSequence<T>): IMutableSequence<T> {
  let seq: IMutableSequence<T>;
  if (typeof (object as any).set === 'function') {
    seq = object as IMutableSequence<T>;
  } else {
    seq = new ArraySequence<T>(object as IArrayLike<T>);
  }
  return seq;
}


/**
 * A sequence for a builtin JS array-like object.
 */
export
class ArraySequence<T> implements IMutableSequence<T> {
  /**
   * Construct a new array sequence.
   *
   * @param source - The array-like object of interest.
   */
  constructor(source: IArrayLike<T>) {
    this._source = source;
  }

  /**
   * The length of the sequence.
   */
  get length(): number {
    return this._source.length;
  }

  /**
   * Create an iterator over the object's values.
   *
   * @returns A new iterator which traverses the object's values.
   */
  iter(): ArrayIterator<T> {
    return new ArrayIterator<T>(this._source);
  }

  /**
   * Get the value at the specified index.
   *
   * @param index - The index of interest.
   *
   * @returns The value at the specified index, or `undefined`
   *   if the index is negative, non-integral, or out of range.
   */
  at(index: number): T {
    return this._source[index];
  }

  /**
   * Set the value at the specified index.
   *
   * @param index - The positive integer index of interest.
   *
   * @param value - The value to set at the specified index.
   *
   * #### Undefined Behavior
   * An `index` which is negative, non-integral, or out of range.
   */
  set(index: number, value: T): void {
    this._source[index] = value;
  }

  private _source: IArrayLike<T>;
}


/**
 * An iterator for a generic sequence.
 */
export
class SequenceIterator<T> implements IIterator<T> {
  /**
   * Construct a new sequence iterator.
   *
   * @param source - The sequence of interest.
   */
  constructor(source: ISequence<T>) {
    this._source = source;
  }

  /**
   * Create an iterator over the object's values.
   *
   * @returns A reference to `this` iterator.
   */
  iter(): this {
    return this;
  }

  /**
   * Create an independent clone of the current iterator.
   *
   * @returns A new independent clone of the current iterator.
   *
   * #### Notes
   * The source sequence is shared among clones.
   */
  clone(): SequenceIterator<T> {
    let result = new SequenceIterator<T>(this._source);
    result._index = this._index;
    return result;
  }

  /**
   * Get the next value from the source sequence.
   *
   * @returns The next value from the source sequence, or `undefined`
   *   if the iterator is exhausted.
   */
  next(): T | undefined {
    if (this._index >= this._source.length) {
      return undefined;
    }
    return this._source.at(this._index++);
  }

  private _index = 0;
  private _source: ISequence<T>;
}