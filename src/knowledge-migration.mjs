// Add clickable options to the original W1 questions without changing their stems or recorded grades.
const choices={
 'w1-01':{
  auto:['15','30','60','120'],teleop:['30','60','120','150'],hive:['5','10','20','30'],score:['40','44','46','50'],phase:['Autonomous','TeleOp','Override','Deprecated']
 },
 'w1-02':{
  class:['class','new','public','import'],main:['start','run','init','main'],file:['hello.java','Hello.class','Hello.java','Main.java'],return:['int','void','String','boolean']
 },
 'w1-03':{
  annotation:['Autonomous','Override','TeleOp','Disabled'],entry:['main','runOpMode','loop','init'],wait:['sleep','waitForStart','start','opModeIsActive'],active:['isStopRequested','isStarted','waitForStart','opModeIsActive']
 },
 'w1-04':{
  init:['start','loop','init','stop'],loop:['loop','init','runOpMode','main'],stop:['init','start','loop','stop'],inherit:['implements','extends','import','new']
 }
};
export function migrateKnowledgeChoices(db){
 if(db.knowledgeChoicesVersion===1)return false;
 for(const lesson of db.lessons){
  for(const q of lesson.fillQuestions||[]){
   const values=choices[lesson.id]?.[q.id];
   if(q.options||!values||!values.includes(q.accepts?.[0]))continue;
   q.type='choice';q.options=values.map(value=>({value,text:value}));q.accepts=[q.accepts[0]];
  }
 }
 db.knowledgeChoicesVersion=1;return true;
}
