/* Local-only calculation worker. No requests containing user inputs. */
importScripts('/assets/retirement-simulator-model.js');
self.onmessage = ({data}) => {
  const {id,input,options,comparison} = data || {};
  try {
    const result = comparison ? RetirementSimulatorModel.compare(input,comparison,options) : RetirementSimulatorModel.run(input,options);
    self.postMessage({id,result});
  } catch(error) { self.postMessage({id,error:error.message || 'Unable to calculate this estimate.'}); }
};
