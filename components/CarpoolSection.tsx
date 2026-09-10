"use client";

import { useState } from "react";

export interface Carpool {
  id: number;
  driver: string;
  car: string;
  totalSeats: number;
  passengers: string[];
  meetingPoint: string;
}

interface CarpoolSectionProps {
  carpools: Carpool[];
  currentUser: string;
  onJoinCar: (carId: number) => void;
  onLeaveCar: (carId: number) => void;
  onUpdateSeats: (carId: number, delta: number) => void;
  onAddCar: (car: Carpool) => void;
  onDeleteCar: (carId: number) => void;
}

export default function CarpoolSection({
  carpools,
  currentUser,
  onJoinCar,
  onLeaveCar,
  onUpdateSeats,
  onAddCar,
  onDeleteCar,
}: CarpoolSectionProps) {
  const [showAddCar, setShowAddCar] = useState(false);
  const [carModel, setCarModel] = useState("");
  const [seats, setSeats] = useState(4);
  const [meetingPoint, setMeetingPoint] = useState("");

  const isDriverAnywhere = carpools.some((car) => car.driver === currentUser);

  const handleCreateCar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!carModel.trim() || !meetingPoint.trim()) return;

    onAddCar({
      id: Date.now(),
      driver: currentUser,
      car: carModel,
      totalSeats: Math.max(2, seats),
      passengers: [],
      meetingPoint,
    });

    setCarModel("");
    setMeetingPoint("");
    setSeats(4);
    setShowAddCar(false);
  };

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold text-white">Ruta y Carpooling</h2>
          <p className="text-xs text-slate-400">Coordinación de vehículos y asientos disponibles</p>
        </div>

        {!isDriverAnywhere ? (
          <button
            onClick={() => setShowAddCar(!showAddCar)}
            className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-3 py-1.5 rounded-lg transition-colors"
          >
            {showAddCar ? "✕ Cancelar" : "+ Ofrecer mi auto"}
          </button>
        ) : (
          <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded font-medium">
            🚗 Conductor registrado
          </span>
        )}
      </div>

      {/* Formulario para registrar un auto */}
      {showAddCar && (
        <form onSubmit={handleCreateCar} className="bg-slate-950/80 border border-slate-800 rounded-lg p-4 space-y-3">
          <h3 className="text-xs font-semibold text-slate-300 uppercase">Detalles de tu vehículo</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input
              type="text"
              placeholder="Modelo (ej. Toyota RAV4)"
              value={carModel}
              onChange={(e) => setCarModel(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-md px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
            <input
              type="number"
              min="2"
              max="12"
              placeholder="Total asientos con chofer"
              value={seats}
              onChange={(e) => setSeats(parseInt(e.target.value, 10) || 4)}
              className="bg-slate-900 border border-slate-800 rounded-md px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
            <input
              type="text"
              placeholder="Punto de encuentro y hora"
              value={meetingPoint}
              onChange={(e) => setMeetingPoint(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-md px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>
          <button
            type="submit"
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-4 py-2 rounded-md transition-colors"
          >
            Publicar Vehículo
          </button>
        </form>
      )}

      {/* Grid de vehículos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {carpools.length === 0 ? (
          <p className="text-xs text-slate-500 italic col-span-2 py-3">No hay autos ofrecidos aún para esta expedición.</p>
        ) : (
          carpools.map((car) => {
            const availableSeats = car.totalSeats - (1 + car.passengers.length);
            const isUserInThisCar = car.passengers.includes(currentUser);
            const isUserDriver = car.driver === currentUser;

            return (
              <div
                key={car.id}
                className="bg-slate-950/60 border border-slate-800 rounded-lg p-4 flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex justify-between items-baseline mb-2">
                    <h3 className="font-semibold text-sm text-white">
                      {car.car} ({car.driver})
                    </h3>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[11px] font-semibold ${
                          availableSeats > 0 ? "text-emerald-400" : "text-slate-500"
                        }`}
                      >
                        {availableSeats} cupos libres
                      </span>
                      {isUserDriver && (
                        <button
                          onClick={() => onDeleteCar(car.id)}
                          title="Eliminar auto"
                          className="text-slate-500 hover:text-rose-400 text-xs"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-400 mb-2 py-1 px-2 bg-slate-900/80 rounded border border-slate-800">
                    <span>
                      Capacidad total: <strong className="text-white">{car.totalSeats} asientos</strong>
                    </span>
                    {isUserDriver && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onUpdateSeats(car.id, -1)}
                          className="w-5 h-5 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700"
                        >
                          -
                        </button>
                        <button
                          type="button"
                          onClick={() => onUpdateSeats(car.id, 1)}
                          className="w-5 h-5 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700"
                        >
                          +
                        </button>
                      </div>
                    )}
                  </div>

                  <p className="text-xs text-slate-400 mb-1">
                    <strong className="text-slate-300">Punto:</strong> {car.meetingPoint}
                  </p>
                  <p className="text-xs text-slate-400">
                    <strong className="text-slate-300">Pasajeros:</strong>{" "}
                    {car.passengers.length > 0 ? car.passengers.join(", ") : "Sin pasajeros aún"}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-800/80">
                  {isUserDriver ? (
                    <div className="text-center py-1">
                      <span className="text-[11px] text-emerald-400 font-medium">
                        🚗 Eres el conductor
                      </span>
                    </div>
                  ) : isDriverAnywhere ? (
                    <button
                      disabled
                      className="w-full text-xs py-1.5 rounded font-medium bg-slate-900 text-slate-600 border border-slate-800 cursor-not-allowed"
                    >
                      No puedes sumarte (conduces tu auto)
                    </button>
                  ) : isUserInThisCar ? (
                    <button
                      onClick={() => onLeaveCar(car.id)}
                      className="w-full text-xs bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 py-1.5 rounded transition-colors"
                    >
                      Bajarme de este auto
                    </button>
                  ) : (
                    <button
                      onClick={() => onJoinCar(car.id)}
                      disabled={availableSeats <= 0}
                      className={`w-full text-xs py-1.5 rounded font-medium transition-colors ${
                        availableSeats > 0
                          ? "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                          : "bg-slate-900 text-slate-600 border border-slate-800 cursor-not-allowed"
                      }`}
                    >
                      {availableSeats > 0 ? "🚗 Sumarme a este auto" : "Auto lleno"}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}