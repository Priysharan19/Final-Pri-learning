/**
 * Pri Learning original Class IX 2026–27: Linear Equations in Two Variables.
 * Official syllabus: https://cbseacademic.nic.in/web_material/CurriculumMain27/SecPart1/Maths_SecP1IX_2026-27.pdf (PDF p. 6)
 *
 * This is a DRAFT STUDY ONLY pack, deliberately NOT imported by the app.
 * It must not be issued as graded content or exposed as server answer escrow.
 * Text, diagrams and worked solutions are newly authored for Pri Learning.
 */
export const class9Linear202627 = {
  id: 'pri-cbse9-202627-linear-gap-v1',
  version: '2026.10.14.1',
  chapter: 'Linear Equations in Two Variables',
  class: 9,
  curriculumTrack: 'CBSE standard',
  syllabusYear: '2026-27',
  competencyIds: ['C-3.2', 'C-8.1', 'C-9.1'],
  classification: 'core',
  provenance: 'original-Pri-Learning',
  status: 'draft-unwired-independent-review-pending',
  mode: 'study-only',
  concepts: [
    'Each equation ax+by=c describes a straight line of ordered-pair solutions; a pair describes their common points.',
    'A nonzero determinant a1*b2-a2*b1 gives one intersection. Proportional full triples describe the same line. Proportional x,y coefficients but inconsistent constants describe distinct parallel lines.',
    'Elimination adds or subtracts equivalent equations to remove an unknown. Always test the proposed pair in both original equations.',
    'When both intercepts are positive, a line ax+by=c encloses area (c/a)(c/b)/2 with the perpendicular positive axes.'
  ],
  misconceptionTargets: ['mistaking parallel for coincident lines', 'forgetting a coefficient when eliminating', 'using rectangle area instead of triangle area', 'treating ticket counts as negative or fractional'],
  workedExamples: [
    {
      id: 'pl9-lin-w01', question: 'Solve 2x+3y=17 and x-y=1.',
      steps: ['x=y+1 from the second equation.', 'Substitute: 2(y+1)+3y=17, so y=3.', 'Then x=4; check 8+9=17 and 4-3=1.'],
      answer: '(4,3)', proof: { kind: 'unique', equations: [[2,3,17],[1,-1,1]], xy: [4,3] }
    },
    {
      id: 'pl9-lin-w02', question: 'Why do 2x+3y=12 and 4x+6y=25 have no common solution?',
      steps: ['Double the first equation to obtain 4x+6y=24.', 'The second asserts the same left side equals 25.', 'Because 24 cannot equal 25, the lines are distinct and parallel.'],
      answer: 'No solution', proof: { kind: 'none', equations: [[2,3,12],[4,6,25]] }
    },
    {
      id: 'pl9-lin-w03', question: 'Three pencils and two erasers cost ₹31; two pencils and five erasers cost ₹39. Find the unit prices.',
      steps: ['Write 3p+2e=31 and 2p+5e=39.', 'Multiply by 5 and 2 respectively: 15p+10e=155 and 4p+10e=78. Thus 11p=77 and p=7.', 'Then 21+2e=31 so e=5. Check 14+25=39.'],
      answer: 'Pencil ₹7, eraser ₹5', proof: { kind: 'unique', equations: [[3,2,31],[2,5,39]], xy: [7,5] }
    }
  ],
  questions: [
    {
      id:'pl9-lin-q01', archetype:'elimination-intersection', question:'Solve 2x+y=11 and x-y=1. Verify the intersection.',
      hint:'Add the equations to cancel y.',
      steps:['Adding gives 3x=12 so x=4.','Substitute into x-y=1: y=3.','Check 2(4)+3=11 and 4-3=1.'],
      answer:'(4,3)', commonWrong:'Checking only one of the two equations.',
      proof:{kind:'unique', equations:[[2,1,11],[1,-1,1]],xy:[4,3]}
    },
    {
      id:'pl9-lin-q02', archetype:'elimination-intersection', question:'Find the intersection of 3x+y=13 and x-y=3 algebraically.',
      hint:'The y terms disappear when you add.',
      steps:['Add to obtain 4x=16 so x=4.','Then 4-y=3 gives y=1.','Both originals are satisfied.'],
      answer:'(4,1)', commonWrong:'Assuming the same x and y coordinates.',
      proof:{kind:'unique', equations:[[3,1,13],[1,-1,3]],xy:[4,1]}
    },
    {
      id:'pl9-lin-q03', archetype:'contradiction-parallel', question:'Explain why x+2y=7 and 2x+4y=11 have no solution.',
      hint:'Multiply the whole first equation by two.',
      steps:['The first equation requires 2x+4y=14.','The second requires 2x+4y=11.','Both cannot hold, so the lines are distinct parallel lines.'],
      answer:'No solution',commonWrong:'Scaling only the left side, not the constant.',
      proof:{kind:'none',equations:[[1,2,7],[2,4,11]]}
    },
    {
      id:'pl9-lin-q04', archetype:'contradiction-parallel', question:'Classify 2x-3y=5 and 4x-6y=12; explain the answer.',
      hint:'Twice the first constant would be 10.',
      steps:['Doubling the first equation gives 4x-6y=10.','The second contradicts it with 4x-6y=12.','Thus no ordered pair solves the system.'],
      answer:'No solution',commonWrong:'Treating proportional left sides as automatically coincident.',
      proof:{kind:'none',equations:[[2,-3,5],[4,-6,12]]}
    },
    {
      id:'pl9-lin-q05', archetype:'coincident-infinite', question:'Prove 3x-y=9 and 6x-2y=18 share infinitely many points and name two.',
      hint:'The second equation is a multiple of the first.',
      steps:['Doubling all terms of 3x-y=9 gives the second equation.','They are the same line.','(3,0) and (4,3) are two distinct solutions.'],
      answer:'Infinitely many; (3,0), (4,3)',commonWrong:'Assuming two displayed equations must produce exactly one solution.',
      proof:{kind:'same', equations:[[3,-1,9],[6,-2,18]],points:[[3,0],[4,3]]}
    },
    {
      id:'pl9-lin-q06', archetype:'coincident-infinite', question:'Classify 2x+5y=8 and -4x-10y=-16 and give two common points.',
      hint:'Multiply every term in the first equation by -2.',
      steps:['The second equation is -2 times the first.','Their full solution sets coincide.','For example, (4,0) and (-1,2) solve both.'],
      answer:'Infinitely many; (4,0), (-1,2)', commonWrong:'Believing negative scaling changes the solution set.',
      proof:{kind:'same', equations:[[2,5,8],[-4,-10,-16]],points:[[4,0],[-1,2]]}
    },
    {
      id:'pl9-lin-q07', archetype:'two-price-context', question:'A fair sells 38 tickets: adults ₹12, pupils ₹8, revenue ₹380. Find both counts.',
      hint:'Set up separate equations for total tickets and total rupees.',
      steps:['Let a+s=38, 12a+8s=380.','Subtract 8(a+s)=304 to obtain 4a=76, so a=19.','Then s=19; both conditions check.'],
      answer:'19 adults and 19 pupils',commonWrong:'Treating ticket counts as the costs themselves.',
      proof:{kind:'unique',equations:[[1,1,38],[12,8,380]],xy:[19,19],nonnegativeInteger:true}
    },
    {
      id:'pl9-lin-q08', archetype:'two-price-context', question:'A show sells 30 tickets at ₹10 regular or ₹6 reduced price, earning ₹228. Find both counts.',
      hint:'Eliminate reduced tickets by subtracting six times the total count.',
      steps:['Let r+d=30 and 10r+6d=228.','Subtract 6(r+d)=180 to obtain 4r=48, r=12.','Then d=18; 120+108=228.'],
      answer:'12 regular and 18 reduced',commonWrong:'Finding noninteger counts and failing to reject them.',
      proof:{kind:'unique',equations:[[1,1,30],[10,6,228]],xy:[12,18],nonnegativeInteger:true}
    },
    {
      id:'pl9-lin-q09', archetype:'axis-triangle-area', question:'The line 2x+3y=12 crosses the positive axes. Find the triangle area enclosed by the line and axes.',
      hint:'Set each variable to zero to find each intercept.',
      steps:['At y=0 the x intercept is 6.','At x=0 the y intercept is 4.','Area=(1/2)(6)(4)=12 square units.'],
      answer:'12 square units',commonWrong:'Using 6×4 without the one-half factor.',
      proof:{kind:'area',equation:[2,3,12],intercepts:[6,4],area:12},
      figure:{type:'coordinate-intercepts',points:{O:[0,0],X:[6,0],Y:[0,4]},segments:[['O','X'],['O','Y'],['X','Y']],alt:'Triangle bounded by the coordinate axes and the line joining the intercepts (6,0) and (0,4).'}
    },
    {
      id:'pl9-lin-q10', archetype:'axis-triangle-area', question:'Find the area between the line 3x+2y=18 and the positive x and y axes.',
      hint:'The axis intercepts are the legs of a right triangle.',
      steps:['The x intercept is 6.','The y intercept is 9.','Area=(1/2)(6)(9)=27 square units.'],
      answer:'27 square units',commonWrong:'Adding the intercepts instead of multiplying perpendicular lengths.',
      proof:{kind:'area',equation:[3,2,18],intercepts:[6,9],area:27},
      figure:{type:'coordinate-intercepts',points:{O:[0,0],X:[6,0],Y:[0,9]},segments:[['O','X'],['O','Y'],['X','Y']],alt:'Right triangle formed by the origin, (6,0) and (0,9) on equal-scale Cartesian axes.'}
    },
    {
      id:'pl9-lin-q11', archetype:'parameter-coincidence', question:'For what k do x+2y=6 and 2x+4y=k have infinitely many solutions? Classify other k.',
      hint:'All three coefficients must have the same ratio.',
      steps:['The second left-hand side doubles the first.','The right-hand side must also double: k=12.','For any k other than 12, the lines are parallel and distinct.'],
      answer:'k=12, otherwise no solution',commonWrong:'Thinking a proportional normal vector gives one intersection.',
      proof:{kind:'parameter',equation:[1,2,6],second:[2,4],factor:2,k:12}
    },
    {
      id:'pl9-lin-q12', archetype:'parameter-coincidence', question:'Determine k for infinitely many solutions of 3x-y=8 and 6x-2y=k. What if k differs?',
      hint:'Scale the constant along with both coefficients.',
      steps:['Twice the first equation is 6x-2y=16.','Therefore k=16 gives coincident lines.','Every other k gives inconsistent parallel lines.'],
      answer:'k=16, otherwise no solution',commonWrong:'Retaining constant 8 after doubling the left-hand side.',
      proof:{kind:'parameter',equation:[3,-1,8],second:[6,-2],factor:2,k:16}
    }
  ]
};
export default class9Linear202627;
