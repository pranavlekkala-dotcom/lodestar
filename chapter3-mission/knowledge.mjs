// Keep valid old information when a later contact fails. Never manufacture a
// precise fix by averaging retransmissions of the same coarse search region.
export function mergeKnowledge(previous,incoming){
 if(!incoming)return previous?structuredClone(previous):null;if(!previous)return structuredClone(incoming);
 const precise=incoming.positionBoundKm<previous.positionBoundKm?incoming:previous;
 return {...structuredClone(precise),ascent:incoming.ascent||previous.ascent||null,receivedTimeS:Math.max(previous.receivedTimeS||0,incoming.receivedTimeS||0),source:precise.source};
}
