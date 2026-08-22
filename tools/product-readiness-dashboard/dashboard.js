const dimensions=[
['Engineering Reliability',97],
['Core Product Capability',45],
['AI Intelligence Maturity',50],
['Handwriting Reality',55],
['Content Coverage',25],
['Teacher Ecosystem',30],
['Student Validation',10],
['Competitive Position',40]
];
const app=document.getElementById('app');
app.innerHTML=dimensions.map(([name,value])=>`<div class="card"><h2>${name}</h2><h3>${value.toFixed(2)}%</h3><div class="bar"><div class="fill" style="width:${value}%"></div></div></div>`).join('');
