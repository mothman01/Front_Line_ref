'use strict';

/**
 * Default site content used on first run and as fallbacks. Kept in a single
 * module so the public routes and the seeding step stay in sync.
 */

function defaultCourses() {
  return [
    {
      id: 'pistol-1',
      name: 'Pistol 1 — Core Marksmanship',
      comingSoon: false,
      intro:
        'Pistol 1 is designed for shooters who already understand basic handgun operation but want to improve their confidence, accuracy and consistency. This is not a first-time shooter course.',
      description: [
        'Students will begin with a safety and dry-fire assessment, followed by a baseline group to identify individual strengths and problem areas. Training will focus on grip, stance, trigger control, sight management, single-shot corrections and presentations from the low ready. Students will then progress into controlled pairs, cadence development and basic static target transitions.',
        'The goal is to help each shooter establish reliable fundamentals that can be carried into future training.',
      ],
      prerequisite: '',
    },
    {
      id: 'rifle-1',
      name: 'Rifle 1 — Core Marksmanship',
      comingSoon: false,
      intro:
        'Rifle 1 is designed for shooters who already understand basic rifle or carbine operation and want to improve their accuracy, equipment setup and overall consistency.',
      description: [
        'Students will begin by reviewing their rifle, sling, optic and basic handling before confirming their zero. Training will include deliberate single-shot work, supported accuracy, presentations from the ready, controlled pairs, cadence development, standing and kneeling positions, and basic static target transitions.',
        'The goal is to establish a dependable shooting foundation and help each student better understand their rifle, optic and individual performance.',
      ],
      prerequisite: '',
    },
    {
      id: 'pistol-2',
      name: 'Pistol 2 — Applied Performance',
      comingSoon: false,
      intro:
        'Pistol 2 builds upon the fundamentals developed in Pistol 1 by introducing additional speed, time pressure and more complex shooting exercises.',
      description: [
        'Students will work on presentations to the first shot, controlled pairs, faster cadence drills, speed-versus-accuracy exercises, multiple-target transitions, reloads and reengagement. The course may also introduce controlled movement into a designated firing position and a short medical-response exercise after all firearms have been cleared.',
        'The goal is to improve speed, decision-making and consistency without sacrificing safe firearm handling or accountable accuracy.',
      ],
      prerequisite:
        'Pistol 1 or instructor approval based on demonstrated safe handling and shooting ability.',
    },
    {
      id: 'rifle-2',
      name: 'Rifle 2 — Applied Performance',
      comingSoon: false,
      intro:
        'Rifle 2 builds upon the fundamentals developed in Rifle 1 by introducing faster engagements, positional changes and more demanding shooting exercises.',
      description: [
        'Students will begin with zero and performance confirmation before progressing into presentations from the ready, controlled pairs, recoil-control drills, multiple-target transitions, close-range optic-offset work, reloads and reengagement. Training may also include standing and kneeling positions, supported shooting around a barricade and controlled movement into a designated firing position.',
        'The goal is to develop faster and more efficient rifle performance while maintaining accuracy, control and sound decision-making.',
      ],
      prerequisite:
        'Rifle 1 or instructor approval based on demonstrated safe handling and shooting ability.',
    },
    {
      id: 'dynamic-shooting-1',
      name: 'Dynamic Shooting 1 — Controlled Movement',
      comingSoon: true,
      intro:
        'Dynamic Shooting 1 is intended to bridge the gap between traditional static range training and controlled movement-based shooting.',
      description: [
        'Students will work through short, clearly defined stages that combine movement between designated positions, target transitions, reloads, positional changes and basic use of cover. All movement will take place at a controlled pace within clearly marked boundaries and designated firing areas.',
        'The course emphasizes muzzle awareness, trigger-finger discipline, communication, safe movement and maintaining accountability while transitioning between tasks. Students must demonstrate consistent firearm handling and acceptable accuracy before speed is introduced.',
      ],
      prerequisite:
        'Successful completion of the applicable Pistol 2 or Rifle 2 course, or instructor approval.',
    },
    {
      id: 'dynamic-shooting-2',
      name: 'Dynamic Shooting 2 — Applied Movement',
      comingSoon: true,
      intro:
        'Dynamic Shooting 2 builds upon the skills introduced in Dynamic Shooting 1 by adding more complex stage layouts, multiple shooting areas, additional positional changes and greater emphasis on time management and decision-making.',
      description: [
        'Students may be required to move between designated positions, engage targets from supported and unsupported positions, perform reloads and make simple decisions under moderate time pressure. Any increase in pace will only be introduced after the student demonstrates safe handling, acceptable accuracy and consistent judgment.',
        'The goal is to develop disciplined movement, efficient transitions and reliable performance in a more dynamic environment without encouraging reckless speed or unsafe firearm handling.',
      ],
      prerequisite: 'Dynamic Shooting 1 or instructor approval.',
    },
  ];
}

function defaultSafetyRules() {
  return [
    {
      title: 'Liability Waiver Required',
      body: [
        'Every participant must complete and sign the Front Line Refinement Participant Agreement, Assumption of Risk, and Liability Waiver before the scheduled session begins.',
        'If you arrive without a completed and signed liability waiver, you will not handle a firearm, enter the firing line, or shoot. No exceptions will be made.',
        'Signing the waiver does not guarantee participation if any other safety, eligibility, or equipment requirement is not satisfied.',
      ],
    },
    {
      title: 'Age and Identification',
      body: [
        'Participants must be at least 21 years old.',
        'A valid government-issued photo ID is required.',
        'The name on the identification must match the name on the booking and liability waiver.',
        'Front Line Refinement does not currently provide instruction to minors.',
      ],
    },
    {
      title: 'Legal Eligibility',
      body: [
        'Every participant must be legally permitted to possess and use firearms.',
        'By attending a session, you confirm that no law, court order, criminal conviction, or other restriction prohibits you from possessing or handling a firearm or ammunition.',
      ],
    },
    {
      title: 'Student-Owned Firearms',
      body: [
        'Participants must bring their own firearm.',
        'Front Line Refinement does not currently rent, lend, or provide firearms.',
        'The firearm must be appropriate for the scheduled 9mm or 5.56 coaching session.',
        'Participants are responsible for ensuring their firearm is lawful, properly maintained, and in safe operating condition.',
        'Known defects, modifications, or prior malfunctions must be disclosed before the session begins.',
        'The coach may inspect a firearm for obvious safety concerns, but this is not a gunsmith inspection or guarantee of mechanical condition.',
        'The coach may prohibit the use of any firearm believed to be unsafe, inappropriate, or incompatible with the lesson.',
      ],
    },
    {
      title: 'Company-Provided Ammunition',
      body: [
        'All live ammunition used during instruction will be provided by Front Line Refinement.',
        'Outside or student-provided ammunition is not permitted.',
        'Ammunition will be selected according to the firearm, lesson, and host range\u2019s requirements.',
        'Participants must accurately identify their firearm\u2019s caliber and chamber markings.',
        'Ammunition remains company property until issued for use during the session.',
        'Unused ammunition remains with Front Line Refinement and has no cash or credit value.',
        'The amount fired may be reduced because of safety concerns, student ability, equipment problems, range conditions, or available instructional time.',
      ],
    },
    {
      title: 'Alcohol, Drugs, and Impairment',
      body: [
        'Participants may not attend while under the influence of alcohol, marijuana, illegal drugs, or any medication that interferes with judgment, coordination, or safe firearm handling.',
        'The coach may deny or terminate participation if a person appears impaired, excessively fatigued, emotionally distressed, or otherwise unable to participate safely.',
      ],
    },
    {
      title: 'Required Protective Equipment',
      body: [
        'Approved eye and hearing protection must be worn whenever required by the coach or host range.',
        'Participants must wear clothing and footwear appropriate for a shooting range. Open-toed shoes, low-cut clothing that may trap hot cartridge cases, or other unsafe clothing may be prohibited.',
      ],
    },
    {
      title: 'Firearm-Safety Requirements',
      body: [
        'Treat every firearm as though it is loaded.',
        'Keep the muzzle pointed in a safe direction.',
        'Keep their finger outside the trigger guard until instructed to fire and ready to do so.',
        'Know the target and what is around and beyond it.',
        'Handle firearms only when authorized by the coach.',
        'Immediately obey every cease-fire and stop command.',
        'Never leave a firearm unattended.',
        'Immediately report malfunctions, injuries, or unsafe conditions.',
        'Never attempt to repair or clear an unfamiliar malfunction without direction.',
      ],
    },
    {
      title: 'Firing-Line Control',
      body: [
        'The coach determines when firearms may be loaded, handled, fired, unloaded, or removed from the firing line.',
        'Certain exercises will be conducted with one active shooter at a time. Multiple lanes may be used only when the coach determines that the participants, lesson, and range conditions allow it safely.',
        'The coach may return the class to single-shooter operation or stop an exercise at any time.',
      ],
    },
    {
      title: 'Unsafe Conduct',
      body: [
        'Horseplay, threatening behavior, arguments, intentional rule violations, and careless firearm handling are prohibited.',
        'The coach may pause or immediately terminate a participant\u2019s session for unsafe behavior, failure to follow instructions, suspected impairment, unsuitable equipment, or any condition that creates an unreasonable risk.',
      ],
    },
    {
      title: 'Host-Range Rules',
      body: [
        'All host-range rules remain in effect during Front Line Refinement sessions. When a host-range rule is more restrictive than a company rule, the host-range rule controls.',
        'Participants may also be required to complete the range\u2019s own waiver or guest-registration documents.',
      ],
    },
    {
      title: 'Nature of the Coaching',
      body: [
        'Front Line Refinement provides private firearms and marksmanship coaching. Unless expressly stated otherwise in writing, sessions are not Wisconsin CCW-certification courses and do not issue a state-recognized firearm-training credential.',
      ],
    },
    {
      title: 'Questions and Personal Responsibility',
      body: [
        'Participants are encouraged to ask questions whenever they are uncertain. Never perform an action with a firearm that you do not understand or feel capable of completing safely.',
        'Every participant shares responsibility for maintaining a safe, respectful, and controlled training environment.',
      ],
    },
  ];
}

const defaultContentOverrides = {
  safety_intro:
    'Your safety and the safety of everyone on the range are the highest priorities at Front Line Refinement. Every participant must understand and follow these rules.',
  safety_closing: 'No signed waiver. No firearm handling. No shooting. No exceptions.',
};

module.exports = {
  defaultCourses,
  defaultSafetyRules,
  defaultContentOverrides,
};
