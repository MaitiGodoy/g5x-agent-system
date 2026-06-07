#!/usr/bin/env python3
"""Debug script for bridge connection to Ollama."""
import os, json, asyncio, aiohttp

async def test():
    url = os.environ.get('DOUTOR_FALLBACK_URL', 'http://172.16.2.1:11434/v1/chat/completions')
    key = os.environ.get('OPENROUTER_API_KEY', '')
    model = os.environ.get('DOUTOR_FALLBACK_MODEL', 'mistral:7b')
    print(f'URL: {url}')
    print(f'KEY set: {bool(key)}')
    print(f'Model: {model}')
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                url,
                headers={'Authorization': f'Bearer {key}', 'Content-Type': 'application/json'},
                json={'model': model, 'messages': [{'role': 'user', 'content': 'Say hello'}]},
                timeout=aiohttp.ClientTimeout(total=30)
            ) as resp:
                print(f'Status: {resp.status}')
                if resp.status == 200:
                    data = await resp.json()
                    print(f'Response: {data["choices"][0]["message"]["content"]}')
                else:
                    txt = await resp.text()
                    print(f'Error body: {txt[:500]}')
    except Exception as e:
        print(f'Exception: {type(e).__name__}: {e}')

asyncio.run(test())
