'use client'

import { useState, useEffect } from 'react'

export function Greeting({ name }: { name: string }) {
  const [phrase, setPhrase] = useState('Good morning')

  useEffect(() => {
    const h = new Date().getHours()
    setPhrase(h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening')
  }, [])

  return (
    <h1 className="font-serif text-[2.5rem] leading-[1.15] font-light text-foreground">
      <span suppressHydrationWarning>{phrase}</span>
      {', '}
      <span className="font-medium">{name}</span>
    </h1>
  )
}
