/**
 * Original Pri Learning Class IX Geometry 2026–27 — triangle congruence study.
 * Source: https://cbseacademic.nic.in/web_material/CurriculumMain27/SecPart1/Maths_SecP1IX_2026-27.pdf (PDF pp. 7–8).
 * NOT WIRED into student bundles, NOT a server-issued question bank.
 * Proofs require independent mathematical examiner review before publication.
 */
export const class9Congruence202627 = {
 id:'pl-cbse9-congruence-v1',version:'2026.10.14.1',track:'CBSE-standard',grade:9,
 syllabus:'2026–27 Triangles — Congruence Theorems',
 competencies:['C-4.1','C-4.2','C-7.3'],
 classification:'core',rights:'original-Pri-Learning',mode:'study-only',
 status:'draft-unwired-independent-proof-review-pending',
 concepts:[
  'Two triangles are congruent when a rigid motion can make corresponding vertices, sides and angles coincide. The vertex order in the congruence statement records their correspondence.',
  'SAS uses two sides and their included angle. SSS uses all three sides. ASA uses two angles and their included side; AAS follows from the 180° angle sum.',
  'For right triangles, matching hypotenuse and one corresponding leg imply congruence by RHS. CPCT gives equal corresponding parts only AFTER congruence is justified.',
  'SSA is not generally a congruence criterion. An acute-angle construction can intersect a distance circle at two different points, making two possible triangles.',
  'An isosceles triangle has equal angles opposite its equal sides. Its vertex angle follows by subtracting both base angles from 180°.'
 ],
 workedExamples:[
  {id:'pl9-tri-w01',question:'AB=DE=5 cm, AC=DF=7 cm and included ∠BAC=∠EDF=40°. Why is BC=EF?',
   steps:['The equal angles are included between the corresponding equal sides.','SAS gives triangle ABC congruent to DEF with A↔D, B↔E, C↔F.','By CPCT, the third corresponding sides BC and EF are equal.'],answer:'BC=EF (SAS, CPCT)',proof:{kind:'sas',mapping:['A:D','B:E','C:F'],included:true}},
  {id:'pl9-tri-w02',question:'A right triangle has hypotenuse 15 cm and leg 9 cm. Find the other leg and explain RHS.',
   steps:['Pythagoras gives missing leg squared = 15²−9²=144.','The missing positive length is 12 cm.','If another right triangle has equal corresponding hypotenuse and 9-cm leg, RHS proves congruence.'],answer:'12 cm',proof:{kind:'rhs',hypotenuse:15,leg:9,other:12}},
  {id:'pl9-tri-w03',question:'AB=10 cm, BC=7 cm and ∠BAC=30°. Is C uniquely determined on the ray AC?',
   steps:['The perpendicular distance from B to ray AC is 10sin30°=5 cm.','A radius-7 cm circle centred at B intersects the ray at two positive positions, since 5<7<10.','Those two positions produce different triangles with exactly the same SSA data.'],answer:'No: two noncongruent triangles',proof:{kind:'ssa-two',adjacent:10,opposite:7,angleDegrees:30,altitude:5}}
 ],
 questions:[
  {id:'pl9-tri-q01',archetype:'sas-correspondence',question:'AB=DE, AC=DF and ∠BAC=∠EDF. Prove ∠ABC=∠DEF.',
   hint:'Which equal angle lies between the matching sides?',steps:['The equal angles are included between AB,AC and DE,DF.','By SAS, △ABC≅△DEF with A↔D, B↔E, C↔F.','Thus ∠ABC=∠DEF by CPCT.'],
   answer:'∠ABC=∠DEF',commonError:'Calling a non-included angle SAS.',proof:{kind:'sas',mapping:['A:D','B:E','C:F'],included:true}},
  {id:'pl9-tri-q02',archetype:'sas-correspondence',question:'PQ=XY, PR=XZ and ∠QPR=∠YXZ. Which side must equal QR? Show why.',
   hint:'Write the vertex correspondence before using CPCT.',steps:['The given angle is between the two equal side pairs.','SAS yields △PQR≅△XYZ with P↔X, Q↔Y, R↔Z.','Therefore QR=YZ. The claim QR=XZ is not justified.'],
   answer:'QR=YZ',commonError:'Matching QR with XZ just because both are named sides.',proof:{kind:'sas',mapping:['P:X','Q:Y','R:Z'],included:true}},
  {id:'pl9-tri-q03',archetype:'sss-correspondence',question:'AB=DE=5, BC=EF=7, CA=FD=8 cm. State a valid criterion and the matching angle to ∠ACB.',
   hint:'Find the common endpoint in each pair of adjacent matching sides.',steps:['All three sides of △ABC and △DEF match consistently.','By SSS, △ABC≅△DEF with C↔F.','Hence ∠ACB=∠DFE.'],
   answer:'SSS and ∠DFE',commonError:'Changing triangle order when naming corresponding angles.',proof:{kind:'sss',sides:[5,7,8],mapping:['A:D','B:E','C:F']}},
  {id:'pl9-tri-q04',archetype:'sss-correspondence',question:'KL=RS=6, LM=ST=8, MK=TR=10 cm. Which angle matches ∠KLM? Prove.',
   hint:'The vertex L lies between KL and LM.',steps:['Three corresponding side equalities give △KLM≅△RST by SSS.','The mapping is K↔R, L↔S, M↔T.','Therefore ∠KLM=∠RST by CPCT.'],
   answer:'SSS and ∠RST',commonError:'Matching angles by their first letter rather than middle vertex.',proof:{kind:'sss',sides:[6,8,10],mapping:['K:R','L:S','M:T']}},
  {id:'pl9-tri-q05',archetype:'asa-angle-sum',question:'For △ABC and △DEF, ∠A=∠D=52°, ∠B=∠E=63°, AB=DE. Prove congruence and calculate ∠C.',
   hint:'Is AB between the specified angles?',steps:['The equal side lies between the two pairs of equal angles: ASA.','Therefore △ABC≅△DEF.','∠C=180°−52°−63°=65°, so ∠F=65° as well.'],
   answer:'ASA; ∠C=65°',commonError:'Using 360° for the interior angles of a triangle.',proof:{kind:'asa',angles:[52,63,65],included:true}},
  {id:'pl9-tri-q06',archetype:'asa-angle-sum',question:'∠P=∠X=41°, ∠Q=∠Y=72° and PQ=XY. Show triangles PQR and XYZ are congruent and find ∠R.',
   hint:'PQ joins the known-angle vertices.',steps:['PQ and XY are the included corresponding sides.','The triangles are congruent by ASA.','∠R=180°−41°−72°=67°.'],
   answer:'ASA; ∠R=67°',commonError:'Calling the criterion RHS without a right angle.',proof:{kind:'asa',angles:[41,72,67],included:true}},
  {id:'pl9-tri-q07',archetype:'rhs-leg',question:'Right angles at B and E; AC=DF=13 cm and AB=DE=5 cm. Prove △ABC≅△DEF and find BC.',
   hint:'AC and DF are the hypotenuses; then subtract squares.',steps:['RHS applies: right angles, equal hypotenuses, matching legs.','By Pythagoras, BC²=13²−5²=144.','BC=12 cm. The positive root gives the length.'],
   answer:'RHS; BC=12 cm',commonError:'Adding the shorter leg square to the hypotenuse square.',proof:{kind:'rhs',hypotenuse:13,leg:5,other:12}},
  {id:'pl9-tri-q08',archetype:'rhs-leg',question:'Right angles at L and S, KM=RT=25 cm and KL=RS=7 cm. Show congruence and calculate LM.',
   hint:'The side opposite the right angle is the hypotenuse.',steps:['Right angles, equal hypotenuses and one equal corresponding leg imply RHS.','LM²=25²−7²=576.','Therefore LM=24 cm.'],
   answer:'RHS; LM=24 cm',commonError:'Using a negative square root for a side length.',proof:{kind:'rhs',hypotenuse:25,leg:7,other:24}},
  {id:'pl9-tri-q09',archetype:'ssa-counterexample',question:'AB=10 cm, BC=7 cm and ∠BAC=30°. Explain why this SSA information need not determine one triangle.',
   hint:'Compare BC with the perpendicular distance from B to the ray AC.',steps:['Distance from B to ray AC is 10sin30°=5 cm.','Since 5<7<10, the radius-7 circle around B meets the positive ray twice.','Both intersection points give triangles satisfying all three stated conditions.'],
   answer:'Two possible triangles; SSA is insufficient',commonError:'Treating SSA as a guaranteed rigid congruence condition.',
   proof:{kind:'ssa-two',adjacent:10,opposite:7,angleDegrees:30,altitude:5},
   figure:{type:'ray-circle',A:[0,0],B:[10,0],angleDegrees:30,radius:7,alt:'From A draw a ray at thirty degrees to AB; draw a circle centered at B of radius seven. Intersections are not labelled.'}},
  {id:'pl9-tri-q10',archetype:'ssa-counterexample',question:'AB=12 cm, BC=8 cm and ∠BAC=30°. Is the triangle uniquely constructible? Prove your claim.',
   hint:'Compute the altitude from B to the ray, then consider a distance circle.',steps:['Distance from B to ray AC is 12sin30°=6 cm.','The circle with center B and radius 8 crosses the positive ray twice because 6<8<12.','Thus two noncongruent triangles satisfy the data.'],
   answer:'Not unique; two possible triangles',commonError:'Assuming a diagram drawn once proves uniqueness.',
   proof:{kind:'ssa-two',adjacent:12,opposite:8,angleDegrees:30,altitude:6},
   figure:{type:'ray-circle',A:[0,0],B:[12,0],angleDegrees:30,radius:8,alt:'Draw a ray from A making thirty degrees with AB and a circle centered at B of radius eight; intersections deliberately unlabelled.'}},
  {id:'pl9-tri-q11',archetype:'isosceles-base-angle',question:'AB=AC, ∠B=(2x+5)° and ∠C=(3x−10)°. Find x and ∠A, naming the theorem.',
   hint:'Equal sides imply equal opposite angles.',steps:['Isosceles base-angle theorem gives 2x+5=3x−10.','Thus x=15 and both base angles are 35°.','∠A=180°−70°=110°.'],
   answer:'x=15; ∠A=110°',commonError:'Making A and B equal instead of B and C.',
   proof:{kind:'isosceles',left:[2,5],right:[3,-10],x:15,apex:110}},
  {id:'pl9-tri-q12',archetype:'isosceles-base-angle',question:'PQ=PR; ∠Q=(4x−7)° and ∠R=(2x+13)°. Find x and the vertex angle ∠P.',
   hint:'The base angles Q and R are equal.',steps:['By the base-angle theorem, 4x−7=2x+13.','Then x=10 and each base angle equals 33°.','∠P=180°−66°=114°.'],
   answer:'x=10; ∠P=114°',commonError:'Believing every isosceles triangle is equilateral.',
   proof:{kind:'isosceles',left:[4,-7],right:[2,13],x:10,apex:114}}
 ]
};
export default class9Congruence202627;
