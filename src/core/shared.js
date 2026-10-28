/* Shared vocabulary and AI output shapes for ABG Impact Journal.
 * Used by the internal journal (src/journal.js) and the community Edge Function
 * (supabase/functions/community, bundled by scripts/build-community.mjs), so internal and
 * community interviews produce the same structured impact records. */

export const CATEGORIES = [
  {id:'engagement', label:'Student engagement'},
  {id:'personal', label:'Personal development'},
  {id:'creative', label:'Educational and creative development'},
  {id:'longterm', label:'Long-term student outcomes'},
  {id:'reach', label:'Program reach and participation'},
  {id:'community', label:'Community and partnership impact'},
];
export const THEMES = [
  {id:'confidence', label:'Confidence'},
  {id:'self_expression', label:'Self-expression'},
  {id:'attendance', label:'Attendance'},
  {id:'classroom_engagement', label:'Classroom engagement'},
  {id:'creativity', label:'Creative development'},
  {id:'artistic_skills', label:'Artistic skills'},
  {id:'continued_engagement', label:'Continued participation'},
  {id:'belonging', label:'Belonging'},
  {id:'communication', label:'Communication'},
  {id:'leadership', label:'Leadership'},
  {id:'collaboration', label:'Collaboration'},
  {id:'alumni_return', label:'Alumni engagement'},
  {id:'volunteering', label:'Volunteering'},
  {id:'public_art', label:'Public art'},
  {id:'school_partnership', label:'School partnership'},
  {id:'family_community', label:'Community involvement'},
  {id:'long_term_development', label:'Long-term development'},
  {id:'challenges', label:'Challenges and unmet needs'},
];
export const AUDIENCES = [
  {id:'donors', label:'Donors and foundations', short:'Donors', emphasis:'number of students served, program reach, student outcomes, continued participation, long-term development, what financial support made possible, and verified evidence of program effectiveness'},
  {id:'schools', label:'School administrators', short:'Schools', emphasis:'school attendance, classroom engagement, program participation, student confidence, communication skills, academic development, student retention, and access to arts education'},
  {id:'corporate', label:'Corporate partners', short:'Corporate partners', emphasis:'community impact, student participation, employee volunteer involvement, volunteer hours, completed projects, and partnership outcomes'},
  {id:'community', label:'Community organizations and neighborhood councils', short:'Community groups', emphasis:'youth engagement, community participation, neighborhood art projects, family involvement, public murals, and school and community partnerships. Never claim crime reduction or other broad community statistics'},
  {id:'artists', label:'Artists and volunteers', short:'Artists and volunteers', emphasis:'creative collaboration, student engagement, volunteer experiences, community contribution, and artistic development'},
];
export const DOMAIN_GROUPS = [{id:'academic', label:'Academic progress'}, {id:'personal', label:'Community and personal development'}, {id:'longterm', label:'Long-term student success'}, {id:'program', label:'Program engagement'}, {id:'staff', label:'Staff and employment'}];
export const DOMAINS = [
  {id:'attendance', label:'School attendance', group:'academic', change:true},
  {id:'academics', label:'Grades and academic performance', group:'academic', change:true},
  {id:'engagement', label:'Motivation and school engagement', group:'academic', change:true},
  {id:'graduation', label:'High school graduation', group:'academic', milestone:true},
  {id:'higher_ed', label:'College or further education', group:'longterm', milestone:true},
  {id:'career', label:'Career, employment or internships', group:'longterm', milestone:true},
  {id:'returned', label:'Returned to ABG as mentor, volunteer or instructor', group:'longterm', milestone:true},
  {id:'arts_continued', label:'Continued art or creative pursuits', group:'longterm', milestone:true},
  {id:'risk', label:'Reduced risky behavior', group:'personal', change:true, sensitive:true},
  {id:'social', label:'Positive relationships and peer groups', group:'personal', change:true},
  {id:'wellbeing', label:'Emotional well-being and sense of belonging', group:'personal', change:true},
  {id:'community_involvement', label:'Community involvement', group:'personal', change:true},
  {id:'activities', label:'Productive after-school activities', group:'personal', change:true},
  {id:'confidence', label:'Confidence, leadership and communication', group:'personal', change:true},
  {id:'aspirations', label:'Decision-making and future aspirations', group:'personal', change:true},
  {id:'behavior', label:'Behavior', group:'personal', change:true},
  {id:'participation', label:'Continued participation in ABG', group:'program'},
  {id:'mentorship', label:'Mentor relationships at ABG', group:'program'},
  {id:'leadership_abg', label:'Leadership roles within ABG', group:'program', milestone:true},
  {id:'access', label:'Access to arts education', group:'program'},
  {id:'artistic', label:'Artistic skills', group:'program'},
  {id:'pathways', label:'Career or college interests', group:'longterm'},
  /* staff and employment outcomes (Staff Impact stories) */
  {id:'employment', label:'Paid employment at ABG', group:'staff', milestone:true},
  {id:'first_job', label:'First paid job', group:'staff', milestone:true},
  {id:'role_growth', label:'Promotion or expanded responsibilities', group:'staff', milestone:true},
  {id:'pro_skills', label:'Professional or artistic skill development', group:'staff'},
  {id:'training', label:'Training or mentorship received', group:'staff'},
  {id:'staff_leadership', label:'Leadership responsibilities', group:'staff'},
  {id:'mentoring_students', label:'Mentoring or teaching ABG students', group:'staff', milestone:true},
  {id:'community_contribution', label:'Contribution to arts education and the community', group:'staff'},
  {id:'further_ed', label:'Further education or certifications', group:'staff', milestone:true},
  {id:'next_employment', label:'Later or additional employment', group:'staff', milestone:true},
  {id:'stability', label:'Personal growth, stability and sense of purpose', group:'staff'},
  {id:'other', label:'Other', group:'program'},
];
export const STAFF_DOMAINS = DOMAINS.filter(d => d.group === 'staff').map(d => d.id);
export const OBSERVERS = [
  {id:'abg_staff', label:'ABG staff (Kyle)'},
  {id:'teacher', label:'Teacher'},
  {id:'school_staff', label:'School administrator or staff'},
  {id:'parent', label:'Parent or family'},
  {id:'student', label:'The student'},
  {id:'records', label:'Records or documents'},
  {id:'self', label:'The person themselves'},
  {id:'volunteer', label:'A volunteer'},
  {id:'community', label:'A community member'},
  {id:'other', label:'Someone else'},
];
/* community contributors: how they are connected to ABG, and whose experience they share */
export const RELATIONSHIPS = [
  {id:'current_student', label:'Current Student', short:'Student'},
  {id:'alumni', label:'Former Student / Alumni', short:'Alumni'},
  {id:'staff', label:'Staff Member', short:'Staff'},
  {id:'parent', label:'Parent / Guardian', short:'Parent'},
  {id:'volunteer', label:'Volunteer', short:'Volunteer'},
  {id:'friend', label:'Friend / Community Member', short:'Community member'},
];
export const PERSPECTIVES = [{id:'self', label:'My own experience'}, {id:'witnessed', label:'An experience I personally witnessed'}];
export const SUBJECTS = [{id:'student', label:'A student'}, {id:'staff', label:'A staff member'}, {id:'general', label:'ABG or the community in general'}];
/* which story type a community submission becomes: only Student Impact or Staff Impact (or a general story) */
export function communityStoryType(intake){
  const i = intake || {};
  if (i.perspective === 'witnessed') return i.subject === 'staff' ? 'staff' : i.subject === 'student' ? 'student' : 'general';
  if (i.relationship === 'staff') return 'staff';
  if (i.relationship === 'current_student' || i.relationship === 'alumni') return 'student';
  return 'general';
}
export const LINK_TYPES = [
  {id:'same_student', label:'Same student'},
  {id:'same_school', label:'Same school'},
  {id:'same_mural', label:'Same mural'},
  {id:'same_program', label:'Same program'},
  {id:'same_community', label:'Same community'},
  {id:'same_partnership', label:'Same partnership'},
  /* set only by a person who confirmed it: a Student Impact story and a Staff Impact story about the same individual */
  {id:'same_person', label:'Same person (student and staff stories)'},
];
export const METRIC_FIELDS = [
  {id:'startGrade', label:'Grade or age when they started', short:'Starting grade or age', type:'text', ph:'e.g. 7th grade, about 12'},
  {id:'yearsWithAbg', label:'Years involved with ABG', short:'Years with ABG', type:'number', unit:'years'},
  {id:'sessionsAttended', label:'Sessions or workshops attended', short:'Sessions attended', type:'number', unit:'sessions'},
  {id:'programs', label:'ABG programs or projects', short:'Programs', type:'text', ph:'e.g. School mural program'},
  {id:'artworksCompleted', label:'Murals or artworks completed', short:'Artworks completed', type:'number', unit:'works'},
  {id:'continuedArt', label:'Kept making art after the program', short:'Kept making art', type:'choice', options:['Yes','No']},
  {id:'grades', label:'Grades or schoolwork during or after ABG', short:'Grades', type:'choice', options:['Improved','Stayed about the same','Declined']},
  {id:'schoolAttendance', label:'School attendance during or after ABG', short:'School attendance', type:'choice', options:['Improved','Stayed about the same','Declined']},
  {id:'stillParticipating', label:'Still participating in ABG', short:'Still participating', type:'choice', options:['Yes','No']},
  {id:'graduated', label:'Graduated high school', short:'Graduated high school', type:'choice', options:['Yes','No','Not yet (still in school)']},
  {id:'firstGenCollege', label:'First in their family to attend college', short:'First-generation college', type:'choice', options:['Yes','No']},
  {id:'nextStep', label:'College, training or creative work afterward', short:'College or creative path', type:'text', ph:'e.g. community college art classes'},
  {id:'returnedToAbg', label:'Came back to ABG (volunteer, mentor or alum)', short:'Came back to ABG', type:'choice', options:['Yes','No']},
  {id:'currentStatus', label:'What they are doing now', short:'Doing now', type:'text', ph:'e.g. high school senior'},
];
export const METRIC_STATUS = [
  {id:'verified', label:'Verified', tone:'good'},
  {id:'reported', label:'Reported', tone:'blue'},
  {id:'estimate', label:'Estimate', tone:'warn'},
];
export const STORY_TYPES = [{id:'student', label:'Student Impact', tone:'teal'}, {id:'staff', label:'Staff Impact', tone:'purple'}];
export const STAFF_STATUS = [{id:'current', label:'Current staff member'}, {id:'former', label:'Former staff member'}];
export const EMPLOYMENT_TYPES = [{id:'full_time', label:'Full-time'}, {id:'part_time', label:'Part-time'}, {id:'temporary', label:'Temporary'}, {id:'contract', label:'Contract'}, {id:'volunteer', label:'Volunteer'}, {id:'unknown', label:'Unknown'}];
export const FORMER_STUDENT = [{id:'yes', label:'Yes, former ABG student'}, {id:'no', label:'No'}, {id:'unknown', label:'Unknown'}];
export const STAFF_FIELDS = [
  {id:'staffStatus', label:'Current or former staff member', short:'Current or former', type:'choice', options:['Current staff','Former staff'], group:'employment'},
  {id:'role', label:'Current or most recent role at ABG', short:'Role', type:'text', ph:'e.g. Teaching artist', group:'employment'},
  {id:'firstRole', label:'First position at ABG', short:'First position', type:'text', ph:'e.g. Mural assistant', group:'employment'},
  {id:'startYear', label:'Year they started working with ABG', short:'Started', type:'text', ph:'e.g. 2019', group:'employment'},
  {id:'yearsWithAbg', label:'Years working with ABG', short:'Years working with ABG', type:'number', unit:'years', group:'employment'},
  {id:'opportunityType', label:'Type of opportunity', short:'Opportunity', type:'choice', options:['Paid employment','Paid stipend or internship','Volunteer (unpaid)'], group:'employment'},
  {id:'employmentType', label:'Employment type', short:'Employment type', type:'choice', options:['Full-time','Part-time','Temporary','Contract','Volunteer'], group:'employment'},
  {id:'firstJob', label:'ABG was their first paid job', short:'First paid job', type:'choice', options:['Yes','No'], group:'employment'},
  {id:'positionsHeld', label:'Positions held at ABG', short:'Positions held', type:'number', unit:'positions', group:'employment'},
  {id:'roleGrowth', label:'Promotion or expanded responsibilities', short:'Role growth', type:'choice', options:['Promoted','Responsibilities expanded','No change'], group:'development'},
  {id:'skills', label:'Professional or artistic skills developed', short:'Skills developed', type:'text', ph:'e.g. lesson planning, mural design', group:'development'},
  {id:'trainingReceived', label:'Received training or professional development', short:'Training', type:'choice', options:['Yes','No'], group:'development'},
  {id:'mentored', label:'Received mentorship at ABG', short:'Mentorship received', type:'choice', options:['Yes','No'], group:'development'},
  {id:'leadership', label:'Took on leadership responsibilities', short:'Leadership', type:'choice', options:['Yes','No'], group:'development'},
  {id:'furtherEducation', label:'Further education or certifications', short:'Further education', type:'text', ph:'e.g. art education certificate', group:'development'},
  {id:'mentorsStudents', label:'Mentors or teaches ABG students', short:'Mentors or teaches students', type:'choice', options:['Yes, mentors students','Yes, teaches or instructs students','No'], group:'community'},
  {id:'otherEmployment', label:'Went on to other employment', short:'Later employment', type:'text', ph:'e.g. art teacher at a charter school', group:'career'},
  {id:'inField', label:'Working in the arts, education or nonprofit field', short:'In the field', type:'choice', options:['Yes','No'], group:'career'},
  {id:'currentStatus', label:'What they are doing now', short:'Doing now', type:'text', ph:'e.g. lead teaching artist at ABG', group:'career'},
];
export const STAFF_STAGES = [
  {id: 1, label: 'Background and first involvement'},
  {id: 2, label: 'Employment opportunities'},
  {id: 3, label: 'Professional development'},
  {id: 4, label: 'Personal and community impact'},
  {id: 5, label: 'Long-term outcomes'},
];
export const JOURNEY_STAGES = [
  {id:'student', label:'Student participation'},
  {id:'skills', label:'Skill development'},
  {id:'employment', label:'Employment opportunity'},
  {id:'growth', label:'Professional growth'},
  {id:'community', label:'Community contribution'},
];
export const ABG_CONTEXT = "Arts Bridging the Gap (ABG) is a Los Angeles nonprofit that serves youth from under-resourced communities through arts education, creative programming and community art projects. Kyle Denman is its Program Director.";
export const INTERVIEW_STAGES = [
  {id: 1, label: 'Background and ABG involvement'},
  {id: 2, label: 'Most meaningful changes'},
  {id: 3, label: 'Supporting evidence'},
  {id: 4, label: "ABG's contribution"},
  {id: 5, label: 'Current progress and follow-up'},
];
export const LISTEN_FOR = ['school attendance', 'academic performance', 'high school graduation', 'higher education', 'confidence and creativity', 'emotional well-being and sense of belonging', 'community involvement', 'positive relationships', 'leadership and mentorship', 'career aspirations and opportunities'];
export const STAFF_LISTEN_FOR = ['paid employment versus volunteering, stipends or internships', 'first employment opportunity', 'responsibilities and role changes', 'how long they have worked with ABG', 'skills developed', 'training or mentorship received', 'leadership responsibilities', 'confidence, independence and sense of purpose', 'contributions to the students ABG serves (mentoring, teaching)', 'further education or certifications', 'later or other employment', 'continuing in the arts, education or nonprofit work'];
export const ANALYSIS_SHAPE = `{
  "title": "4 to 8 word title in sentence case, e.g. From hesitant painter to mural lead",
  "summary": "2 or 3 sentences for library cards",
  "story": "the Student Success Story, 200 to 350 words: a concise, compelling narrative covering the student's background, challenges before ABG, how they became involved, their experiences during the program, and the observed changes and outcomes. Warm, engaging and authentic. Mention key outcomes in words, but leave detailed figures to the evidence list. No generic praise, exaggeration or unsupported claims. Leave out any part the interview didn't cover.",
  "entrySummary": "1 or 2 sentences on what this specific interview adds",
  "alias": "the student's first name as given, or null",
  "overview": {"ageOrGrade": "approximate age or grade when involved, or null", "background": "1 or 2 sentences of background relevant to ABG's impact, or null", "involvementDate": "when they were involved with ABG, in Kyle's words, or null"},
  "metricsCard": {"field id": {"value": "the value; for choice fields one of the listed options exactly", "status": "reported | estimate"}},
  "isMinor": "yes | no | unknown",
  "period": "past (months or years ago) | recent",
  "eventDate": {"text": "when the original experience happened, in Kyle's words, or null", "iso": "YYYY, YYYY-MM or YYYY-MM-DD, or null", "approximate": true},
  "program": "ABG program or project, or null",
  "community": "school or community, or null",
  "takeaways": ["3 to 5 takeaways drawn from what Kyle actually said"],
  "structure": {"character": "text or null", "circumstances": "text or null", "involvement": "text or null", "events": "text or null", "outcomes": "text or null", "longTerm": "text or null"},
  "categories": ["category ids"],
  "themes": ["theme ids"],
  "stakeholders": {"primary": ["up to 3 audience ids, most relevant first"], "schools": "one sentence: how this student's documented or reported outcomes answer 'How does ABG benefit students at our school?', or null if nothing relevant", "donors": "one sentence answering 'What difference is our contribution making?', or null", "grants": "one sentence answering 'Can ABG demonstrate outcomes that justify continued funding?', naming the evidence level, or null", "why": "Stakeholder value: 2 or 3 sentences on how the documented outcomes show ABG's impact and support donor funding or school partnerships. Claim only what the evidence supports, and say when outcomes are reported or estimated rather than verified."},
  "evidence": [{"metric": "short name of the outcome, e.g. High school graduation, College enrollment, Field of study, Current job, Returned as instructor, School attendance, Leadership role at ABG, Sessions attended", "domain": "${DOMAINS.map(d => d.id).join(' | ')}", "direction": "achieved (a milestone such as graduating or enrolling) | improved | same | declined | mixed | unclear (only what Kyle said)", "level": "1 personal observation | 2 observable improvement | 3 documented metric (give the number)", "category": "category id", "kind": "numeric for measurable outcomes (numbers, counts, rates, before-and-after comparisons, durations) | qualitative for observations and testimonials", "statement": "what the evidence shows", "value": null, "unit": "students, sessions, hours, percent, years... or null", "before": "the value or situation before ABG, or null", "after": "the value or situation after, or null", "timeframe": "the period compared, e.g. fall 2023 to spring 2024, or null", "status": "reported | estimate | qualitative | unverified | future", "observer": "abg_staff | teacher | school_staff | parent | student | records | other", "basis": "who observed or reported it, e.g. Kyle observed directly; teacher told Kyle; attendance records Kyle mentioned", "observation": "the concrete thing seen or heard that supports it, or null", "activity": "the ABG program or activity involved, or null", "contribution": "how ABG may have contributed, only as Kyle described it, or null (never assume)", "openQuestion": "what is still unknown or should be followed up about this outcome, or null", "inferred": "true only if this outcome is your inference rather than something Kyle stated", "excerpt": "short passage copied word for word from the interview"}],
  "missingMetrics": [{"metric": "Missing data: an outcome that was mentioned but not quantified or confirmed, or a relevant core metric the interview didn't cover. Kyle has no school records, so phrase record-based items as things ABG or the consulting team could request (e.g. School attendance records could be requested from the school; A teacher statement could confirm the change Kyle observed)", "why": "how it would strengthen the case for stakeholders", "howToGet": "where it might come from"}],
  "quotes": [{"text": "the words", "speaker": "first name or role, or Narrator", "kind": "exact | remembered | paraphrase"}],
  "milestones": [{"date": {"text": "when, or null", "iso": "YYYY or YYYY-MM, or null"}, "label": "what happened", "phase": "circumstances | involvement | immediate | short_term | long_term | future", "confirmed": true}],
  "materials": [{"type": "photo | artwork | video | testimonial | record | survey | other", "description": "what exists and where, as Kyle described it"}],
  "recommendedFollowUps": ["up to 5 concrete actions, e.g. Verify attendance information with the school"],
  "followUpQuestions": ["up to 2 questions still open for Kyle, if any"],
  "possibleLinks": [{"storyId": "id from the other-stories list", "type": "link type id", "reason": "short reason"}],
  "containsIdentifying": false,
  "containsSensitive": false
}`;
export const STAFF_ANALYSIS_SHAPE = `{
  "title": "4 to 8 word title in sentence case, e.g. From mural crew to lead teaching artist",
  "summary": "2 or 3 sentences for library cards",
  "story": "the Impact Narrative, 200 to 350 words: a compelling but accurate account of the person's involvement with ABG and how it influenced their life: where they were before, how they became involved, the opportunities ABG provided, how they grew, what they contribute now and where they are today. Warm and specific. Leave out any part the interview didn't cover. No exaggeration of ABG's role.",
  "entrySummary": "1 or 2 sentences on what this specific interview adds",
  "alias": "the person's first name as given, or null",
  "overview": {"background": "1 or 2 sentences on their circumstances before or when joining ABG, relevant to the impact, or null", "involvementDate": "when they were involved with or worked at ABG, in Kyle's words, or null"},
  "staffCard": {"field id": {"value": "the value; for choice fields one of the listed options exactly", "status": "reported | estimate", "excerpt": "short passage copied word for word from the interview that supports it"}},
  "journey": [{"stage": "student | skills | employment | growth | community", "text": "one sentence on this stage, only from what the interview says", "excerpt": "supporting passage copied word for word"}],
  "journeySummary": "for a former ABG student only: 2 or 3 sentences on their progression from ABG student to staff member and what it shows about ABG's long-term impact, without exaggerating ABG's role; otherwise null",
  "isMinor": "yes | no | unknown",
  "period": "past (months or years ago) | recent",
  "eventDate": {"text": "when the story mainly took place, in Kyle's words, or null", "iso": "YYYY, YYYY-MM or YYYY-MM-DD, or null", "approximate": true},
  "program": "ABG program or project they worked in, or null",
  "community": "school or community, or null",
  "takeaways": ["Key Outcomes: 3 to 5 of the most important employment, professional development, personal growth and community outcomes, drawn from what Kyle actually said"],
  "structure": {"character": "text or null", "circumstances": "text or null", "involvement": "text or null", "events": "text or null", "outcomes": "text or null", "longTerm": "text or null"},
  "categories": ["category ids"],
  "themes": ["theme ids"],
  "stakeholders": {"primary": ["up to 3 audience ids, most relevant first"], "donors": "one sentence on how this story supports donor communications, or null", "grants": "one sentence on how it supports grant applications, naming the evidence level, or null", "schools": "one sentence on how it supports school partnerships, or null", "community": "one sentence on how it supports community impact reporting, or null", "consulting": "one sentence on what it adds to the consulting team's deliverables (for example evidence of employment pathways), or null", "why": "Stakeholder relevance: 2 or 3 sentences. Claim only what the evidence supports, and say when outcomes are reported or estimated rather than verified."},
  "evidence": [{"metric": "short name of the outcome, e.g. Paid position at ABG, First paid job, Promoted to lead artist, Years with ABG, Mentors students, Training received, Later employment", "domain": "${DOMAINS.map(d => d.id).join(' | ')}", "direction": "achieved (a milestone such as being hired or promoted) | improved | same | declined | mixed | unclear (only what Kyle said)", "level": "1 general impression | 2 specific observed change | 3 counted or dated fact (give it)", "category": "category id", "kind": "numeric for durations, counts, dates and before-and-after comparisons | qualitative for observations and testimonials", "statement": "what the evidence shows", "value": null, "unit": "years, months, positions, students... or null", "before": "the situation before, or null", "after": "the situation after, or null", "timeframe": "the period, e.g. 2019 to 2024, or null", "status": "reported | estimate | qualitative | unverified | future", "observer": "abg_staff | self | other", "basis": "how it is known, e.g. Kyle observed directly; the staff member told Kyle", "observation": "the concrete thing seen or heard, or null", "activity": "the ABG program, role or activity involved, or null", "contribution": "how ABG may have contributed, only as Kyle described it, or null", "openQuestion": "what is still unknown, or null", "paid": "yes | no | unknown: for employment outcomes, whether the opportunity was paid, only if the interview says", "inferred": "true only if this outcome is your inference rather than something Kyle stated", "excerpt": "short passage copied word for word from the interview"}],
  "missingMetrics": [{"metric": "Missing data: an outcome mentioned but not dated, quantified or confirmed (e.g. Start date of first paid position not documented; Whether the role was paid is unknown). Kyle doesn't need records, so phrase record-based items as things ABG could look up later", "why": "how it would strengthen the case", "howToGet": "where it might come from"}],
  "quotes": [{"text": "the words", "speaker": "first name or role, or Narrator", "kind": "exact | remembered | paraphrase"}],
  "milestones": [{"date": {"text": "when, or null", "iso": "YYYY or YYYY-MM, or null"}, "label": "what happened (e.g. Joined ABG mural program as a student; Hired as a paid mural assistant; Promoted to lead teaching artist)", "phase": "circumstances | involvement | immediate | short_term | long_term | future", "confirmed": true}],
  "materials": [{"type": "photo | artwork | video | testimonial | record | survey | other", "description": "what exists and where, as Kyle described it"}],
  "recommendedFollowUps": ["up to 5 concrete actions, e.g. Confirm the year the paid position began from ABG payroll records"],
  "followUpQuestions": ["up to 2 questions still open for Kyle, if any"],
  "possibleLinks": [{"storyId": "id from the other-stories list", "type": "link type id", "reason": "short reason"}],
  "containsIdentifying": false,
  "containsSensitive": false
}`;

/* ================= community interviews =================
   Community contributors (students, alumni, staff, parents, volunteers, friends) tell their own story or one they
   witnessed. The server (community Edge Function) builds these prompts, never the browser, and the analysis comes
   back in exactly the same shapes as Kyle's interviews, so it goes through the same review and reporting. */
const relLabel = id => (RELATIONSHIPS.find(r => r.id === id) || {}).label || 'Community member';
export function communityOpeningQ(intake){
  const i = intake || {};
  const who = i.subjectFirstName ? i.subjectFirstName : (i.subject === 'staff' ? 'this staff member' : 'this student');
  if (i.perspective === 'witnessed') {
    if (i.subject === 'general') return 'What have you seen ABG do in the community, and what difference has it made?';
    if (i.relationship === 'parent') return 'What changes have you noticed in ' + (i.subjectFirstName || 'your child') + ' since they got involved with ABG, in their confidence, school or interests?';
    return 'Tell me about ' + who + ' and what you saw happen through their time with ABG.';
  }
  switch (i.relationship) {
    case 'current_student': return "How did you get involved with ABG, and how has it affected you, at school or anywhere else?";
    case 'alumni': return 'Looking back, how did ABG influence your education, career or personal development?';
    case 'staff': return i.formerStudent === 'yes' ? 'You started out as an ABG student. How did you first get involved, and how did you end up working with ABG?' : 'How did you first get involved with ABG, and what opportunities has working with ABG given you?';
    case 'parent': return "How has your family been involved with ABG, and what difference has it made for you?";
    case 'volunteer': return 'What changes or opportunities have you witnessed through your involvement with ABG?';
    default: return 'How have you seen ABG make a difference in the community?';
  }
}
export const COMMUNITY_CLOSING_Q = 'Is there anything else you want ABG to know about your experience?';
export function communityContextText(intake){
  const i = intake || {};
  const bits = ['connected to ABG as: ' + relLabel(i.relationship), i.perspective === 'witnessed' ? 'sharing an experience they personally witnessed' + (i.subject ? ' (about ' + ((SUBJECTS.find(x => x.id === i.subject) || {}).label || '').toLowerCase() + ')' : '') : 'sharing their own experience'];
  if (i.firstName) bits.push("contributor's first name: " + i.firstName);
  if (i.adult === false) bits.push('the contributor is under 18 (a guardian has given ABG permission)');
  if (i.perspective === 'witnessed' && i.subjectFirstName) bits.push("the person it's about: " + i.subjectFirstName);
  if (i.perspective === 'witnessed' && i.subjectMinor === 'yes') bits.push('the person it is about is under 18');
  if (i.programs) bits.push('ABG programs: ' + i.programs);
  if (i.yearsInvolved) bits.push('years involved: ' + i.yearsInvolved);
  if (i.background) bits.push('background they chose to share: ' + i.background);
  if (i.relationship === 'staff' && i.perspective !== 'witnessed') {
    if (i.staffRole) bits.push('role at ABG: ' + i.staffRole);
    if (i.staffStatus) bits.push(i.staffStatus === 'former' ? 'former staff member' : 'current staff member');
    if (i.formerStudent === 'yes') bits.push('was an ABG student before working there' + (i.firstParticipatedYear ? ', first participated around ' + i.firstParticipatedYear : '') + (i.studentPrograms ? ' in ' + i.studentPrograms : '') + (i.transitionYear ? ', began working for ABG around ' + i.transitionYear : ''));
    else if (i.formerStudent === 'no') bits.push('was not an ABG student before working there');
    else bits.push('not known whether they were an ABG student before');
  }
  return bits.join('; ');
}
function protocolFor(intake, type){
  const i = intake || {};
  if (type === 'staff') return `STAFF STORY. Explore only what is relevant: background (how they got involved, what they did before, their first responsibilities); employment (paid positions, first job, how long, employment type, changes in responsibilities, advancement; distinguish PAID work from volunteering, stipends and internships, and never assume a role was paid); professional development (skills, leadership, mentorship received, training, artistic development, further education); personal and community impact (confidence, career goals, mentoring younger participants, continued work in arts or education; financial benefit only in general terms, never amounts); long-term outcomes (current job, career progress, continuing education, long-term involvement with ABG).${i.formerStudent === 'yes' && i.perspective !== 'witnessed' ? ' This person was an ABG student first: naturally explore their experience as a student, skills they built, how they moved into working for ABG, whether ABG gave them their first paid opportunity, their responsibilities and growth, whether they now mentor or teach students, and how their relationship with ABG changed.' : ''}`;
  if (type === 'student') return 'STUDENT STORY. Explore only what is relevant: academic outcomes (grades, attendance, school engagement, graduation, college or further education, educational goals); personal development (confidence, self-expression, creativity, communication, leadership, motivation, belonging, relationships and mentors); arts education (access to art, skills, murals, fashion, visual arts or other ABG programs, continued creative interest, achievements, creative or career goals); long-term outcomes (finishing high school, college or vocational school, careers and jobs, mentoring, community involvement, staying involved in art). Changes in behavior or exposure to positive opportunities only if the contributor raises them; never ask about crime, drugs, gangs, immigration, health or family hardship.';
  return 'COMMUNITY STORY. Explore only what is relevant: what the contributor has seen or experienced through ABG (programs, murals, events, volunteering, family involvement), concrete changes in people or the community, how often or how long they have been involved, and what continues today.';
}
export function communityInterviewPrompt({intake, turns, notes, asked, target, type, avoid}){
  const i = intake || {};
  const convo = (turns || []).map(t => 'Q: ' + t.q + '\nA: ' + (t.status === 'skipped' ? '[skipped]' : t.a)).join('\n\n');
  const witnessed = i.perspective === 'witnessed';
  return `${ABG_CONTEXT}

You are ABG's friendly interviewer on its public "Share Your Story" page. A community member is telling you about ${witnessed ? 'an experience they personally witnessed' : 'their own experience'} with ABG. Two goals matter equally: an authentic story in their own words, AND specific, credible outcomes ABG can report honestly to donors, grant makers and schools.

ABOUT THE CONTRIBUTOR (from their intake form; never ask for these again): ${communityContextText(i)}.

HOW TO TALK
- Speak directly to them ("you"), warmly and simply, like a kind person who is genuinely curious. Many contributors are students or people who don't use technology much. ${i.adult === false ? 'This contributor is under 18: use especially simple, encouraging language, and never ask about sensitive or personal topics.' : ''}
- One question at a time, under 20 words, plain words. You may start with a very short acknowledgement ("Thanks for sharing that."), but no long praise.
- Begin broad, then ask the most valuable follow-up: a specific example of a change, when it happened, how long, how often.
- Never lead toward a positive answer. "Did your grades change?" not "How much did ABG improve your grades?". Negative or mixed experiences are welcome and worth recording.
- They can skip any question or say "I don't know". A skip or "I don't know" closes that topic.
- Never repeat a question or ask about anything already answered or in notes.facts or notes.askedAbout.
${witnessed ? `- They are describing someone else${i.subjectFirstName ? ' (' + i.subjectFirstName + ')' : ''}. Ask only about what they saw or heard firsthand. Never ask them to estimate things they have no way of knowing (for example someone else's grades, unless they saw them). Never ask for last names, addresses, school names or other identifying details about that person.` : '- Ask only about their own experience. Never ask for a last name, address, phone, email or other identifying details.'}
- Never ask about immigration, health, diagnoses, crime, drugs, money amounts or family hardship. If they bring something sensitive up, don't probe it.

${protocolFor(i, type)}

MEASURABLE FOLLOW-UP
When they mention a meaningful outcome, consider whether it can be made more specific, and ask once if it is appropriate: before-and-after (grades, attendance), how many (programs, murals, years, jobs), how long (in a role, involved with ABG), or a milestone (graduated, enrolled, hired, promoted, leading or mentoring). Example: "ABG helped my grades improve." -> "Do you remember roughly what your grades were like before, compared with after?" If they can't say, move on.

Follow-up questions asked so far: ${asked}. Aim for about ${target}. Set "enough" to true when the most meaningful outcomes have the key details or they don't know the rest.
${avoid ? 'Your last suggestion repeated an earlier question ("' + avoid + '"). Choose a different gap.' : ''}

PREVIOUS NOTES: ${JSON.stringify(notes || {facts: [], outcomes: [], askedAbout: []})}

CONVERSATION SO FAR:
${convo}

Reply with only JSON:
{"notes": {"facts": ["short facts already captured"], "outcomes": [{"outcome": "short name", "change": "or null", "when": "or null", "howMuch": "or null"}], "askedAbout": ["topics already asked about, including skipped or don't know"]}, "question": "the next question", "why": "a few words on what it adds", "enough": false}`;
}
export function communityAnalysisPrompt({intake, transcript, type, today}){
  const i = intake || {};
  const witnessed = i.perspective === 'witnessed';
  const name = witnessed ? (i.subjectFirstName || '') : (i.firstName || '');
  const rel = relLabel(i.relationship);
  const obs = witnessed ? ({parent: 'parent', volunteer: 'volunteer', friend: 'community', staff: 'other', current_student: 'other', alumni: 'other'}[i.relationship] || 'other') : 'self';
  const shape = type === 'staff' ? STAFF_ANALYSIS_SHAPE : ANALYSIS_SHAPE;
  return [
    ABG_CONTEXT + ` A community member answered a guided interview on ABG's public "Share Your Story" page. The contributor is: ${rel}, ${witnessed ? 'describing an experience they personally witnessed' : 'describing their own experience'}. Turn the interview into a structured ${type === 'staff' ? 'Staff' : type === 'student' ? 'Student' : 'Community'} Impact Report for ABG staff to review. Today is ${today}.`,
    'Intake details (treat as given): ' + communityContextText(i) + '.',
    name ? `The person the story is about is ${name}. Use only that first name.` : `No first name was given for the person the story is about. Say "a student", "a staff member", "a parent" or similar, and set "alias" to null.`,
    `RULES
- Storytelling and credible measurement matter equally. Write the story in the third person about ${witnessed ? 'the person they describe' : 'the contributor'}, warm and specific, using only what the interview says. It must stand on its own for ABG staff.
- SOURCE OF EVERY OUTCOME: ${witnessed ? `the contributor witnessed it, so set "observer" to "${obs}" and "basis" to what they saw ("The ${rel.toLowerCase()} saw..."). Something they only heard from someone else is status "unverified".` : `the contributor is describing their own experience, so set "observer" to "self" and "basis" to "Self-reported by the ${rel.toLowerCase()}".`} Never use observer "abg_staff" or "records" and never status "verified": nobody has checked anything yet.
- Record numbers, dates, durations and before-and-after values only when the contributor stated them, with status "estimate" when approximate ("about", "around", "I think"). If they couldn't give a number, keep the outcome qualitative. Never invent statistics or turn missing information into zero.
- Never invent names, places, outcomes, achievements or quotes. Use null or an empty list when information isn't there. Never add last names or identifying details. Leave out anything sensitive (health, immigration, crime, finances, family hardship) even if mentioned, and set "containsSensitive" true if it came up.
- Negative or mixed experiences are valid outcomes: record them honestly (direction "same", "declined" or "mixed").
- Don't say ABG caused an outcome unless the contributor says so.
- Quotes: "exact" only for words that appear word for word in the interview answers, with the contributor's first name or role as speaker. Never create a quote.
- ${type === 'staff' ? 'Paid work: distinguish paid employment from volunteering, stipends and internships; if pay is not stated, set "paid" to "unknown". Fill staffCard fields only from what was said, each with "excerpt".' : type === 'student' ? 'metricsCard: fill a field only when the interview states it; leave the rest out.' : 'metricsCard: use an empty object.'}
- ${type === 'staff' && i.formerStudent === 'yes' && !witnessed ? 'This staff member was an ABG student first: build the journey from the stages the interview supports, and write journeySummary.' : 'journey: only stages the interview supports; journeySummary null unless they were an ABG student who joined the staff.'}
- possibleLinks must be an empty list. isMinor: ${witnessed ? (i.subjectMinor === 'yes' ? '"yes"' : i.subjectMinor === 'no' ? '"no"' : '"unknown"') : (i.adult === false ? '"yes"' : '"no"')}.
- missingMetrics: what ABG staff could confirm or ask about to make the story more credible.
- recommendedFollowUps: up to 3 things ABG staff could check; followUpQuestions: up to 2 short questions ABG could ask the contributor.`,
    `ID LISTS
categories: ${CATEGORIES.map(c => c.id).join(', ')}
themes: ${THEMES.map(t => t.id).join(', ')}
audiences: ${AUDIENCES.map(a => a.id).join(', ')}`,
    'INTERVIEW\n' + transcript,
    'Reply with only JSON in exactly this shape:\n' + shape,
  ].join('\n\n');
}
