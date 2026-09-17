'use strict';

/**
 * Default site content used on first run and as fallbacks. Kept in a single
 * module so the public routes and the seeding step stay in sync.
 */

function defaultCourses() {
  return [
    {
      id: 'pistol-foundations',
      name: 'Pistol Foundations',
      intro:
        'Introduces the essential skills needed to safely and confidently operate a handgun. Designed for newer firearm owners and shooters who want to rebuild their technique from the ground up.',
      focuses: [
        'Firearm safety and basic operation',
        'Proper grip and shooting stance',
        'Sight alignment and target focus',
        'Trigger control',
        'Breathing and tension management',
        'Safe loading and unloading',
        'Controlled follow-up shots',
        'Building accuracy without sacrificing control',
        'Applying the fundamentals to responsible home-defense preparation',
      ],
      experience: 'None',
      firearm: 'Student-provided 9mm handgun',
      ammunition: 'Use of up to 100 rounds included',
      minimumAge: '21',
    },
    {
      id: 'carbine-foundations',
      name: 'Carbine Foundations',
      intro:
        'Teaches the safe operation and core marksmanship skills needed to confidently use a modern sporting rifle or carbine.',
      focuses: [
        'Firearm safety and basic operation',
        'Proper rifle mounting and shooting stance',
        'Sight and optic fundamentals',
        'Trigger control',
        'Breathing and tension management',
        'Zero confirmation',
        'Safe loading and unloading',
        'Controlled follow-up shots',
        'Building accuracy and consistency',
        'Applying the fundamentals to responsible home-defense preparation',
      ],
      experience: 'None',
      firearm: 'Student-provided carbine chambered in 5.56 NATO',
      ammunition: 'Use of up to 120 rounds included',
      minimumAge: '21',
    },
    {
      id: 'pistol-refinement',
      name: 'Pistol Refinement',
      intro:
        'Designed for shooters who understand basic handgun safety and operation but want to become faster, more accurate, and more consistent.',
      focuses: [
        'Grip consistency',
        'Trigger control',
        'Recoil management',
        'Sight recovery',
        'Controlled shooting cadence',
        'Magazine changes',
        'Malfunction response',
        'Accuracy at varying distances',
        'Transitioning between targets',
        'Performing fundamentals under reasonable time limits',
      ],
      experience: 'Pistol Foundations, equivalent experience, or coach approval',
      firearm: 'Student-provided 9mm handgun',
      ammunition: 'Use of up to 150 rounds included',
      minimumAge: '21',
    },
    {
      id: 'carbine-refinement',
      name: 'Carbine Refinement',
      intro:
        'Helps experienced beginners improve their rifle handling, accuracy, and efficiency.',
      focuses: [
        'Rifle mounting and positional consistency',
        'Sight and optic management',
        'Recoil control',
        'Controlled shooting cadence',
        'Magazine changes',
        'Malfunction response',
        'Supported and unsupported positions',
        'Accuracy at varying distances',
        'Transitioning between targets',
        'Performing fundamentals under reasonable time limits',
      ],
      experience: 'Carbine Foundations, equivalent experience, or coach approval',
      firearm: 'Student-provided carbine chambered in 5.56 NATO',
      ammunition: 'Use of up to 150 rounds included',
      minimumAge: '21',
    },
    {
      id: 'applied-movement',
      name: 'Applied Movement and Defensive Skills',
      intro:
        'Introduces experienced students to safely combining firearm handling with controlled movement.',
      focuses: [
        'Safely moving into and out of shooting positions',
        'Maintaining muzzle and trigger-finger discipline while moving',
        'Controlled lateral and forward movement',
        'Shooting from standing, kneeling, and supported positions',
        'Using available cover responsibly',
        'Transitioning between targets',
        'Controlled follow-up shooting',
        'Responding to coach-directed commands',
        'Making safe decisions while under time and movement demands',
      ],
      experience: 'Relevant Refinement course or coach approval',
      firearm: 'Student-provided 9mm handgun or 5.56 carbine',
      ammunition: 'Use of up to 150 rounds included',
      minimumAge: '21',
    },
    {
      id: 'home-defense',
      name: 'Home-Defense Scenario and Emergency Response',
      intro:
        'Brings together firearm safety, decision-making, household preparedness, and emergency-response awareness.',
      focuses: [
        'Creating a household emergency plan',
        'Situational awareness and target identification',
        'Verbal communication and de-escalation',
        'Family movement and communication planning',
        'Safe firearm access and storage',
        'Understanding walls, backstops, and neighboring spaces',
        'Simulated home-defense decision-making',
        'Calling 911 and communicating with responding officers',
        'Emergency-scene priorities',
        'First-aid kit and trauma-kit familiarization',
        'Basic severe-bleeding response awareness',
      ],
      experience: 'Relevant Refinement course or coach approval',
      firearm: 'No live ammunition in the scenario-training area',
      ammunition: 'Inert training equipment or approved simulation tools',
      minimumAge: '21',
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
