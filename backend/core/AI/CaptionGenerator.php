<?php
/**
 * CaptionGenerator — channel-aware social caption writer via OpenAI.
 *
 * WHY THIS EXISTS
 * ---------------
 * Operators spend a disproportionate amount of time rewriting the same post
 * for each channel. A caption that works on LinkedIn is too long and formal
 * for WhatsApp; a WhatsApp blast needs shorter copy with a CTA. This class
 * generates a first draft tuned to the target channel and tone so the
 * operator edits rather than writes from scratch.
 *
 * INTEGRATION
 * -----------
 * The API key is read from the environment, NOT passed through the UI:
 *
 *     export OPENAI_API_KEY="sk-..."          # set in your server env / .env loader
 *
 *     require_once __DIR__ . '/../AI/CaptionGenerator.php';
 *     $gen = new CaptionGenerator(getenv('OPENAI_API_KEY'));
 *     $caption = $gen->generate('product launch', 'whatsapp', 'friendly');
 *
 * Wire a POST /api/ai/caption endpoint that calls generate() and returns the
 * text for the operator to review before it reaches posts.content.
 * Never auto-populate posts.content without a human review step.
 */

declare(strict_types=1);

final class CaptionGenerator
{
    private const API_URL = 'https://api.openai.com/v1/chat/completions';

    public function __construct(
        private string $openAiApiKey,
        private int $maxTokens = 280
    ) {}

    /**
     * Generate a caption for $topic targeted at $channel with the given $tone.
     * Returns trimmed caption text only — no surrounding quotes.
     *
     * @throws \RuntimeException on HTTP error or unexpected response shape.
     */
    public function generate(string $topic, string $channel, string $tone = 'professional'): string
    {
        $body = json_encode([
            'model'      => 'gpt-4o-mini',   // cheap + fast; good enough for caption drafts
            'max_tokens' => $this->maxTokens,
            'messages'   => [
                [
                    'role'    => 'system',
                    'content' => "You write social media captions. Be concise. "
                               . "Channel: {$channel}. Tone: {$tone}. "
                               . "Return only the caption text, no quotation marks.",
                ],
                [
                    'role'    => 'user',
                    'content' => "Write a caption about: {$topic}",
                ],
            ],
        ], JSON_THROW_ON_ERROR);

        $context = stream_context_create([
            'http' => [
                'method'        => 'POST',
                'header'        => implode("\r\n", [
                    'Content-Type: application/json',
                    'Authorization: Bearer ' . $this->openAiApiKey,
                ]),
                'content'       => $body,
                'ignore_errors' => true,   // capture 4xx/5xx bodies instead of false
            ],
        ]);

        $raw = file_get_contents(self::API_URL, false, $context);

        // $http_response_header is populated by file_get_contents as a side-effect
        $statusLine = $http_response_header[0] ?? 'HTTP/1.1 0 Unknown';
        preg_match('/HTTP\/\S+\s+(\d+)/', $statusLine, $m);
        $statusCode = (int) ($m[1] ?? 0);

        if ($raw === false || $statusCode < 200 || $statusCode >= 300) {
            throw new \RuntimeException(sprintf(
                'CaptionGenerator: OpenAI returned HTTP %d. Response: %s',
                $statusCode,
                is_string($raw) ? substr($raw, 0, 500) : '(no body)'
            ));
        }

        $decoded = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);

        $text = $decoded['choices'][0]['message']['content'] ?? null;

        if (!is_string($text) || trim($text) === '') {
            throw new \RuntimeException(
                'CaptionGenerator: unexpected response shape from OpenAI — '
                . 'choices[0].message.content missing or empty.'
            );
        }

        return trim($text);
    }
}
