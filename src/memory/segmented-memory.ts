import { RadioMemorySegment } from '@springfield/ham-radio-api';

export class RadioSegmentedMemory {
  private segments: Map<number, RadioMemorySegment>;

  constructor(segments?: RadioMemorySegment[]) {
    this.segments = new Map();

    if (segments != undefined) {
      for (const segment of segments) {
        this.segments.set(segment.startAddress, segment);
      }
    }
  }

  public addSegment(segment: RadioMemorySegment): void {
    this.segments.set(segment.startAddress, segment);
  }

  public getSegments(): IterableIterator<RadioMemorySegment> {
    return this.segments.values();
  }

  public getSegment(startAddress: number): RadioMemorySegment | undefined {
    return this.segments.get(startAddress);
  }

  public segmentCount(): number {
    return this.segments.size;
  }

  public findSegment(address: number): RadioMemorySegment | undefined {
    const iterator = this.segments.values();
    let result = iterator.next();

    while (!result.done) {
      const segment = result.value;

      if (segment.startAddress <= address && segment.startAddress + segment.length > address) {
        return segment;
      }

      result = iterator.next();
    }

    return undefined;
  }

  public toArray(): RadioMemorySegment[] {
    return Array.from(this.segments.values());
  }
}
