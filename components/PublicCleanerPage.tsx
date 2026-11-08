'use client';
import React from 'react';
import {CleanerCard} from './care/Cleaners';
import {ProfileChat} from './ProfileChat';
export default function PublicCleanerPage({id}:{id:string}){return <main className="trust-public-page trust-assigned-profile"><a className="trust-back" href="/#cleaners">← Black to White · Исполнители</a><CleanerCard publicId={id}/><ProfileChat workerId={id} demo={id.startsWith('example-')}/><a href="/#quick-book" className="btn accent">Рассчитать уборку</a></main>}
