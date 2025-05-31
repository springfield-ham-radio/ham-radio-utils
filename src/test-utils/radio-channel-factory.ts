import { CTCSS, Frequency, RadioChannel, RadioChannelId, RadioToneType } from '@springfield/ham-radio-api';
import { Factory } from 'fishery';

export function getRandomCTCSS(): CTCSS {
  const values = Object.values(CTCSS); // Get all values from the enum
  const randomIndex = Math.floor(Math.random() * values.length); // Generate a random index
  return values[randomIndex] as CTCSS; // Return the randomly selected value
}

export const radioChannelFactory = Factory.define<RadioChannel>(({ sequence }) => ({
  id: RadioChannelId(sequence.toString()),
  name: `c-${sequence}`,
  transmitFrequency: Frequency(144000),
  receiveFrequency: Frequency(144000),
  transmitTone: { type: RadioToneType.CTCSS, tone: getRandomCTCSS() },
  receiveTone: { type: RadioToneType.CTCSS, tone: getRandomCTCSS() },
}));
