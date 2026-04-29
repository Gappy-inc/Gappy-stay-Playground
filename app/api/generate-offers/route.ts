import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { Booking, OfferTemplate, GeneratedOffer, SurveyAnswers } from '@/types'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const SYSTEM_PROMPT = `You are Gappy Stay, an AI upsell agent for Japanese hotels.
Your goal is to maximize revenue for the hotel while genuinely enhancing the guest's stay experience.
Never feel like a hard sell — always frame offers as "customizing your stay."

You will receive:
1. A guest's booking information (nationality, room type, length of stay, tags)
2. ALL available upsell offer templates
3. Optional: Guest survey answers for deeper personalization

Your task:
- Write a short, warm, personalized_message (1-2 sentences) for EVERY offer
- Return ALL offers in the JSON array — do not skip or omit any offer
- Personalize each message based on: nationality, tags (couple/family/solo/business), length of stay, survey answers
- Apply behavioral economics principles:
  * Anchoring: highlight the original price when discounted
  * Scarcity: use availability count for urgency (if <= 5, mention it)
  * Social proof: use popularity score (if >= 70, add "Most Popular" badge)
  * Framing: frame as enhancement, not cost
- For bundle offers always set badge to "Best Deal"

Language: Match the guest's language field.
Output: Valid JSON array of GeneratedOffer objects. No markdown, no explanation. JSON only.
IMPORTANT: The array must contain one entry for every offer template provided.`

function buildFallback(
  booking: Booking,
  offers: OfferTemplate[]
): GeneratedOffer[] {
  const lang = booking.language
  return offers.map((offer) => {
    let badge: string | undefined
    if (offer.availability <= 3) badge = `Last ${offer.availability} spots`
    else if (offer.popularity >= 70) badge = 'Most Popular'
    if (offer.category === 'bundle') badge = 'Best Deal'

    return {
      offer_id: offer.offer_id,
      title: offer.title[lang] ?? offer.title['en'],
      description: offer.description[lang] ?? offer.description['en'],
      personalized_message:
        lang === 'ja'
          ? 'ご滞在をより特別なものにするためのご提案です。'
          : lang === 'ko'
          ? '특별한 숙박을 위한 맞춤 제안입니다.'
          : lang === 'zh'
          ? '为您量身定制的特别体验推荐。'
          : 'A curated pick to make your stay truly memorable.',
      price: offer.price,
      original_price: offer.original_price,
      unit: offer.unit,
      availability: offer.availability,
      popularity: offer.popularity,
      category: offer.category,
      badge,
      includes: offer.includes,
    }
  })
}

const PURPOSE_LABEL: Record<string, string> = {
  relax: 'Relaxation / leisure',
  sightseeing: 'Sightseeing & cultural experiences',
  business: 'Business trip',
  anniversary: 'Anniversary / special celebration',
}

const MORNING_LABEL: Record<string, string> = {
  slow_breakfast: 'Slow morning with a leisurely breakfast',
  early_start: 'Early start / active morning',
  no_preference: 'No preference',
}

const INTEREST_LABEL: Record<string, string> = {
  spa: 'Onsen / spa',
  food: 'Japanese cuisine / food',
  sightseeing: 'Sightseeing spots',
  shopping: 'Shopping',
  early_checkin: 'Early check-in / early arrival',
  nothing: 'Nothing in particular',
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { booking, offers, survey }: {
    booking: Booking
    offers: OfferTemplate[]
    survey?: SurveyAnswers | null
  } = body

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ offers: buildFallback(booking, offers) })
  }

  const surveySection = survey
    ? `
Guest survey answers (use these for personalization):
- Purpose of visit: ${PURPOSE_LABEL[survey.purpose] ?? survey.purpose}
- Morning preference: ${MORNING_LABEL[survey.morning] ?? survey.morning}
- Interests: ${survey.interests.map((i) => INTEREST_LABEL[i] ?? i).join(', ')}
`
    : ''

  try {
    const userMessage = `Guest booking:
${JSON.stringify(booking, null, 2)}
${surveySection}
Available offer templates:
${JSON.stringify(offers, null, 2)}

Generate personalized offers for this guest. Return a JSON array of GeneratedOffer objects.`

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    })

    const content = message.content[0]
    if (content.type !== 'text') {
      return NextResponse.json({ offers: buildFallback(booking, offers) })
    }

    // Strip markdown code fences if present
    let raw = content.text.trim()
    const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (fenceMatch) raw = fenceMatch[1].trim()

    const parsed: GeneratedOffer[] = JSON.parse(raw)
    return NextResponse.json({ offers: parsed })
  } catch (err) {
    console.error('[generate-offers] Claude API error:', err)
    return NextResponse.json({ offers: buildFallback(booking, offers) })
  }
}
