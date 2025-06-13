import { CTCSS, Frequency, type RadioChannel, RadioChannelId, RadioToneType } from '@springfield/ham-radio-api';
import { Factory } from 'fishery';

export const getRandomCTCSS = (): CTCSS => {
  const values = Object.values(CTCSS); // Get all values from the enum
  const randomIndex = Math.floor(Math.random() * values.length); // Generate a random index
  return values[randomIndex] as CTCSS; // Return the randomly selected value
};

export const radioChannelFactory = Factory.define<RadioChannel>(({ sequence }) => ({
  id: RadioChannelId(sequence.toString()),
  name: `c-${sequence}`,
  receiveFrequency: Frequency(144_000),
  receiveTone: { tone: getRandomCTCSS(), type: RadioToneType.CTCSS },
  transmitFrequency: Frequency(144_000),
  transmitTone: { tone: getRandomCTCSS(), type: RadioToneType.CTCSS },
}));
