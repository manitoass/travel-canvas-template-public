import seed from '../../public/seed.json';
import {applyPlanningOperation} from '../engine/planning';
import {createWorker} from './handler.mjs';

const worker=createWorker({seed,applyPlanningOperation});
export default worker;
