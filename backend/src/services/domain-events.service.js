import { EventEmitter } from 'node:events'

const domainEvents = new EventEmitter({ warnAfter: 100 })

export function publishDomainEvent(eventName, payload = {}) {
  domainEvents.emit(eventName, payload)
}

export function subscribeDomainEvent(eventName, handler) {
  domainEvents.on(eventName, handler)

  return () => {
    domainEvents.off(eventName, handler)
  }
}
