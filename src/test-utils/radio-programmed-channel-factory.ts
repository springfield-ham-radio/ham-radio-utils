import { RadioProgrammedChannel } from '@springfield/ham-radio-api';
import { Factory } from 'fishery';
import { radioChannelFactory } from './radio-channel-factory.js';

export const radioProgrammedChannelFactory = Factory.define<RadioProgrammedChannel>(({ sequence }) => ({
  channelNumber: sequence,
  radioChannel: radioChannelFactory.build(),
}));
